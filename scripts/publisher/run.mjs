#!/usr/bin/env node
// One publishing run (PLAN v2 §11.1 п. 1–6, ЗАДАЧА-2.4). launchd starts it on
// a change under <library>/notes, at load and every 30 minutes; `npm run
// publisher:run` starts the same run by hand.
//
//   wait for quiet → reset the clone to origin/<branch> → exporter --commit
//   [--translate] → git push (fast-forward only; one retry after a fresh fetch)
//   → notify
//
// The exporter is reached only through its CLI JSON contract (§11.3). All IO
// goes through the injected {exec, now, sleep, notify, env, readMtimes,
// readDefaults, readKey}. The AI key (§11.9) reaches the exporter only through
// its child env; translation failures are backed off in state.json.
// PUBLISHER_PROBE=1 only checks that origin answers (the installer's auth probe).
import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { syncToOrigin } from '../lib/git.mjs';
import { changeNotifications, currentProblems, pendingChanges, problemNotifications, summaryLine } from './announce.mjs';
import { layout } from './layout.mjs';
import { acquireLock, releaseLock } from './lock.mjs';
import { makeLogger, rotateLog } from './log.mjs';
import { notify as osNotify } from './notify.mjs';
import { notesMtimes, waitForQuiet } from './quiet.mjs';
import { PROVIDER_IDS } from '../translate/providers.mjs';
import { AI_SKIP, readDraftaDefault, readProviderKey, resolveAi } from './keychain.mjs';
import {
  addTranslationChars,
  markNotified,
  mayNotify,
  readState,
  recordTranslations,
  translationCharsToday,
  translationHold,
  writeState,
} from './state.mjs';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const PUSH_ATTEMPTS = 2;
const THROTTLE_MS = 60 * 60_000;
const EXPORTER_MAX_BUFFER = 64 * 1024 * 1024;
const OFFLINE_REASON = 'offline';

const OFFLINE = /Could not resolve host|nodename nor servname|Network is unreachable|No route to host|Operation timed out|Connection timed out|Connection refused|Temporary failure in name resolution/i;
const REJECTED = /\[rejected\]|\[remote rejected\]|non-fast-forward|fetch first|stale info/i;

class RunError extends Error {}

function processOutput(error) {
  return [error?.stderr, error?.stdout, error?.message].filter(Boolean).join('\n');
}

const firstLine = (text) => String(text).trim().split('\n').find((line) => line.trim()) ?? String(text);
const errorLine = (error) => firstLine(error?.stderr || error?.message || error);
export const isOffline = (error) => OFFLINE.test(processOutput(error));
export const isRejected = (error) => REJECTED.test(processOutput(error));

/**
 * Environment of the exporter child process. The AI provider and key travel
 * here and only here — never in argv, the plist or the log.
 * @param {object} [translation] {provider, key, maxChars, hold} when this run translates
 */
export function exporterEnv(env, translation) {
  const rest = { ...env };
  delete rest.DRAFTA_AI_KEY;
  delete rest.DRAFTA_AI_PROVIDER;
  if (!translation) return rest;
  return {
    ...rest,
    DRAFTA_AI_PROVIDER: translation.provider,
    DRAFTA_AI_KEY: translation.key,
    DRAFTA_TRANSLATE_MAX_CHARS: String(translation.maxChars),
    DRAFTA_TRANSLATE_HOLD: translation.hold,
  };
}

export function exporterArgs(paths, { commit, translate = false }) {
  return [
    join(paths.clone, 'scripts/import-from-drafta.mjs'),
    '--library',
    paths.library,
    '--site',
    paths.clone,
    ...(commit ? ['--commit'] : []),
    ...(commit && translate ? ['--translate'] : []),
    '--json',
  ];
}

function parseExporterJson(stdout) {
  try {
    const result = JSON.parse(String(stdout).trim());
    return result && typeof result === 'object' ? result : null;
  } catch {
    return null;
  }
}

/** Exit 1 still carries the JSON (per-note errors); no JSON at all is a failed run. */
async function runExporter(ctx, { commit, translation }) {
  const options = { cwd: ctx.paths.clone, env: exporterEnv(ctx.env, translation), maxBuffer: EXPORTER_MAX_BUFFER };
  try {
    const { stdout } = await ctx.exec(ctx.node, exporterArgs(ctx.paths, { commit, translate: Boolean(translation) }), options);
    const result = parseExporterJson(stdout);
    if (!result) throw new RunError(`exporter printed no JSON: ${firstLine(stdout || '(empty)')}`);
    return result;
  } catch (error) {
    if (error instanceof RunError) throw error;
    const result = parseExporterJson(error.stdout ?? '');
    if (result) return result;
    throw new RunError(`exporter failed: ${errorLine(error)}`);
  }
}

function git(ctx, args) {
  return ctx.exec('git', args, { cwd: ctx.paths.clone, env: ctx.env });
}

async function publishBranch(ctx) {
  if (ctx.env.PUBLISHER_BRANCH) return ctx.env.PUBLISHER_BRANCH;
  // Never a silent default: a manual run publishes to whatever branch the
  // installer checked out, not to main by accident.
  const { stdout } = await git(ctx, ['symbolic-ref', '--short', 'HEAD']);
  return stdout.trim();
}

async function sendAll(ctx, notifications) {
  for (const notification of notifications) {
    try {
      await ctx.notify(notification);
    } catch (error) {
      ctx.log(`notify failed: ${errorLine(error)}`);
    }
  }
}

/** Throttled notification: the same reason at most once per THROTTLE_MS, remembered in state.json. */
async function notifyThrottled(ctx, state, reason, notification) {
  const at = ctx.now();
  if (!mayNotify(state, reason, at, THROTTLE_MS)) return state;
  await sendAll(ctx, [notification]);
  return markNotified(state, reason, at);
}

async function probe(ctx) {
  try {
    await git(ctx, ['ls-remote', '--quiet', 'origin', 'HEAD']);
    ctx.log('probe: ok');
    return EXIT_OK;
  } catch (error) {
    ctx.log(`${isOffline(error) ? 'probe: offline' : 'probe: auth failed'} — ${errorLine(error)}`);
    return EXIT_FAILED;
  }
}

/** No network: nothing is exported; the owner hears about it only if something is waiting. */
async function deferOffline(ctx, state, error, pending) {
  ctx.log(`deferred: offline — ${errorLine(error)}`);
  let waiting = pending;
  if (!waiting) {
    try {
      waiting = await runExporter(ctx, { commit: false });
    } catch (dryRunError) {
      ctx.log(`dry run failed while offline: ${dryRunError.message}`);
      return EXIT_OK;
    }
  }
  const count = pendingChanges(waiting);
  if (count === 0) return EXIT_OK;
  const next = await notifyThrottled(ctx, state, OFFLINE_REASON, {
    title: 'Отложено: нет сети',
    body: `Ждут публикации: ${count}. Опубликую, когда сеть вернётся.`,
  });
  writeState(ctx.paths.state, next);
  return EXIT_OK;
}

// ── Translation (§11.9 rules 5–6) ──────────────────────────────────────────

const DEFAULT_MAX_CHARS_PER_RUN = 60_000;
const DEFAULT_MAX_CHARS_PER_DAY = 300_000;
const HOUR_MS = 60 * 60_000;

// Announced once until the reason changes. A mock or unset provider is the
// owner's own choice: logged, not announced.
const SKIP_NOTIFICATIONS = {
  [AI_SKIP.keychain]: {
    title: 'Перевод пропущен: нет доступа к ключу (keychain)',
    body: 'Запустите npm run publisher:install ещё раз и нажмите «Always Allow».',
  },
  [AI_SKIP.noKey]: { title: 'Перевод пропущен: нет ключа AI', body: 'Добавьте ключ в Drafta → Settings → AI.' },
};

const DEFER_LABELS = {
  offline: 'нет сети',
  auth: 'провайдер отклонил ключ',
  'rate-limit': 'лимит запросов провайдера',
  provider: 'ошибка провайдера',
  'invalid-output': 'модель нарушила разметку',
  'no-key': 'нет ключа',
  error: 'внутренняя ошибка',
};

function limitFromEnv(env, name, fallback) {
  const value = Number(env[name]);
  return env[name] && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Provider, key and character budget for this run — or none, with the reason
 * logged (and announced once).
 * @returns {Promise<{translation: object|null, state: object}>}
 */
async function prepareTranslation(ctx, state) {
  const ai = await resolveAi({ readDefaults: ctx.readDefaults, readKey: ctx.readKey, providers: PROVIDER_IDS });
  if (ai.skip) {
    ctx.log(`translate: skipped — ${ai.detail}`);
    if (state.translationSkip !== ai.skip && SKIP_NOTIFICATIONS[ai.skip]) await sendAll(ctx, [SKIP_NOTIFICATIONS[ai.skip]]);
    return { translation: null, state: { ...state, translationSkip: ai.skip } };
  }
  const at = ctx.now();
  const perRun = limitFromEnv(ctx.env, 'PUBLISHER_TRANSLATE_MAX_CHARS_PER_RUN', DEFAULT_MAX_CHARS_PER_RUN);
  const perDay = limitFromEnv(ctx.env, 'PUBLISHER_TRANSLATE_MAX_CHARS_PER_DAY', DEFAULT_MAX_CHARS_PER_DAY);
  const maxChars = Math.max(0, Math.min(perRun, perDay - translationCharsToday(state, at)));
  const translation = { provider: ai.provider, key: ai.key, maxChars, hold: translationHold(state, at) };
  return { translation, state: { ...state, translationSkip: null } };
}

/** Provider usage per translation — the only record of what translating costs. */
function logTranslations(ctx, result) {
  for (const t of result.translated ?? []) {
    const usage = t.usage ? ` in=${t.usage.inputTokens} out=${t.usage.outputTokens} requests=${t.usage.requests}` : '';
    ctx.log(`translate: ${t.slug} ${t.from}→${t.to} ${t.cached ? 'cached' : `${t.provider}/${t.model}${usage} chars=${t.chars}`}`);
  }
  for (const d of result.translationDeferred ?? []) {
    ctx.log(`translate: ${d.slug} deferred — ${d.reason}${d.detail ? `: ${d.detail}` : ''}`);
  }
}

function translationNotifications(events, result, { pushed }) {
  const pages = [...(result.created ?? []), ...(result.updated ?? []), ...(result.unchanged ?? [])];
  const titleOf = (event) => event.title || pages.find((page) => page.slug === event.slug)?.title || event.slug;
  const fresh = pushed ? (result.translated ?? []).filter((t) => !t.cached) : [];
  return [
    ...fresh.map((t) => ({ title: `Переведено: ${titleOf(t)}`, body: t.url ?? '' })),
    ...events.map((event) =>
      event.kind === 'disabled'
        ? { title: `Перевод выключен до правки заметки: ${titleOf(event)}`, body: DEFER_LABELS[event.reason] ?? event.reason }
        : {
            title: `Опубликовано без перевода: ${titleOf(event)}`,
            body: `${DEFER_LABELS[event.reason] ?? event.reason}; повтор через ${Math.round(event.retryInMs / HOUR_MS)} ч`,
          },
    ),
  ];
}

async function finish(ctx, state, result, { pushed }) {
  ctx.log(summaryLine(result, { pushed }));
  logTranslations(ctx, result);
  if (ctx.env.PUBLISHER_VERBOSE === '1') ctx.log(`exporter: ${JSON.stringify(result)}`);
  const at = ctx.now();
  const booked = recordTranslations(addTranslationChars(state, result.translationChars ?? 0, at), result, at);
  const problems = problemNotifications(currentProblems(result), state.announcedProblems);
  await sendAll(ctx, [
    ...(pushed ? changeNotifications(result) : []),
    ...problems.notifications,
    ...translationNotifications(booked.events, result, { pushed }),
  ]);
  writeState(ctx.paths.state, { ...booked.state, announcedProblems: problems.announced });
  return (result.errors ?? []).length > 0 ? EXIT_FAILED : EXIT_OK;
}

async function publish(ctx, initialState) {
  const branch = await publishBranch(ctx);
  const { translation, state } = await prepareTranslation(ctx, initialState);
  for (let attempt = 1; ; attempt += 1) {
    try {
      await syncToOrigin(ctx.paths.clone, branch, { exec: ctx.exec });
    } catch (error) {
      if (isOffline(error)) return deferOffline(ctx, state, error);
      throw new RunError(`git fetch failed: ${errorLine(error)}`);
    }
    const result = await runExporter(ctx, { commit: true, translation });
    if (!result.committed) return finish(ctx, state, result, { pushed: false });
    try {
      await git(ctx, ['push', 'origin', `HEAD:refs/heads/${branch}`]);
      return finish(ctx, state, result, { pushed: true });
    } catch (error) {
      if (isOffline(error)) return deferOffline(ctx, state, error, result);
      if (!isRejected(error)) throw new RunError(`git push failed: ${errorLine(error)}`);
      if (attempt >= PUSH_ATTEMPTS) {
        ctx.log(`push rejected twice: origin/${branch} moved ahead — ${errorLine(error)}`);
        await sendAll(ctx, [{ title: 'Не опубликовано: origin ушёл вперёд', body: `origin/${branch} изменился во время публикации; повторю на следующем прогоне.` }]);
        return EXIT_FAILED;
      }
      ctx.log(`push rejected, fetching origin/${branch} and retrying`);
    }
  }
}

async function publishRun(ctx) {
  const { state, warning } = readState(ctx.paths.state);
  if (warning) ctx.log(warning);
  try {
    const quiet = await waitForQuiet(ctx);
    if (quiet.waitedMs > 0) ctx.log(`quiet after ${Math.round(quiet.waitedMs / 1000)} s${quiet.timedOut ? ' (waited the maximum)' : ''}`);
    return await publish(ctx, state);
  } catch (error) {
    ctx.log(`error: ${error.message}`);
    const next = await notifyThrottled(ctx, state, `error: ${error.message}`, { title: 'Ошибка публикации', body: firstLine(error.message) });
    writeState(ctx.paths.state, next);
    return EXIT_FAILED;
  }
}

function context(io) {
  const env = io.env ?? process.env;
  const paths = layout(env);
  const exec = io.exec ?? promisify(execFile);
  const now = io.now ?? (() => new Date());
  return {
    env,
    paths,
    exec,
    now,
    node: io.node ?? process.execPath,
    sleep: io.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    readMtimes: io.readMtimes ?? (() => notesMtimes(paths.notes)),
    notify: io.notify ?? ((notification) => osNotify(notification, { exec })),
    readDefaults: io.readDefaults ?? ((key) => readDraftaDefault(exec, key)),
    readKey: io.readKey ?? ((provider) => readProviderKey(exec, provider)),
    log: makeLogger(now),
  };
}

/** @returns {Promise<number>} the exit code */
export async function run(io = {}) {
  const ctx = context(io);
  rotateLog(ctx.paths.log);
  if (ctx.env.PUBLISHER_PROBE === '1') return probe(ctx);
  const lock = acquireLock(ctx.paths.lock);
  if (!lock.acquired) {
    ctx.log(`skipped: run ${lock.pid} is still in progress`);
    return EXIT_OK;
  }
  try {
    return await publishRun(ctx);
  } finally {
    releaseLock(ctx.paths.lock);
  }
}

function isMain() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
}

if (isMain()) {
  run().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${new Date().toISOString()} error: ${error.stack ?? error}\n`);
      process.exitCode = EXIT_FAILED;
    },
  );
}
