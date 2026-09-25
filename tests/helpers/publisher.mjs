// Fakes for scripts/publisher/run.mjs (PLAN v2 §11.3: run.mjs takes
// {exec, now, notify, env}; §11.4: quiet waiting takes readMtimes and sleep;
// §11.9: readKey/readDefaults). No launchd, no network, no real clock.
//
// Shapes the plan leaves open, fixed here in one place:
// - exec(cmd, args?, opts?) resolves {stdout, stderr, code: 0} and REJECTS on a
//   non-zero exit with an Error carrying {code, stdout, stderr} — the shape of
//   promisified child_process.execFile. The exporter's JSON on exit 1 is in
//   err.stdout.
// - now() returns a Date; sleep(ms) advances the fake clock and resolves.
// - readMtimes() returns a Map path → mtimeMs (entries mirrored as own
//   properties, so Object.values() sees them too).
// - run(...) resolves an exit code, or an object with exitCode/code.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import { contractFn, importContract } from './contract.mjs';

export const RUN = 'scripts/publisher/run.mjs';
export const T0 = Date.parse('2026-09-25T10:00:00Z');
export const MIN = 60_000;
export const POST = { title: 'Hello world', slug: 'hello-world', lang: 'en', url: 'https://drafta.org/blog/hello-world/' };

export function makeClock(start = T0) {
  let t = start;
  return {
    now: () => new Date(t),
    sleep: async (ms) => {
      t += ms;
    },
    set: (ms) => {
      t = ms;
    },
    get ms() {
      return t;
    },
  };
}

export function mtimes(ms) {
  const map = new Map([
    ['notes', ms],
    ['notes/0A000000-0000-4000-8000-00000000000A.md', ms],
  ]);
  for (const [k, v] of map) map[k] = v;
  return map;
}

export function execError(message, { code = 1, stdout = '', killed = false, signal = null } = {}) {
  return Object.assign(new Error(message), { code, stdout, stderr: message, killed, signal });
}

export function cliJson(overrides = {}) {
  return JSON.stringify({
    created: [],
    updated: [],
    deleted: [],
    skipped: [],
    errors: [],
    committed: false,
    pushed: false,
    ...overrides,
  });
}

/**
 * exec fake. `handle(call)` returns stdout (string) or throws execError;
 * returning undefined means success with empty stdout.
 */
export function makeExec(clock, handle = () => undefined) {
  const calls = [];
  const exec = vi.fn(async (cmd, ...rest) => {
    const args = Array.isArray(rest[0]) ? rest[0] : [];
    const opts = rest.find((r) => r && typeof r === 'object' && !Array.isArray(r)) ?? {};
    const call = { line: [cmd, ...args].join(' '), cmd, args, opts, at: clock.ms };
    calls.push(call);
    const stdout = (await handle(call)) ?? '';
    return { stdout, stderr: '', code: 0, exitCode: 0 };
  });
  return { exec, calls };
}

export const isCli = (call) => call.line.includes('import-from-drafta');
export const isPublish = (call) => isCli(call) && /--commit|--push/.test(call.line);
export const isFetch = (call) => /\bgit\b.*\bfetch\b/.test(call.line);
export const isPushAttempt = (call) => /\bgit\b.*\bpush\b/.test(call.line) || (isCli(call) && /--push/.test(call.line));
export const usesForce = (call) => /--force|--force-with-lease|\s-f(\s|$)|\s\+\S+:/.test(call.line);

export function makeNotify() {
  const sent = [];
  const notify = vi.fn(async (msg) => {
    sent.push(typeof msg === 'string' ? msg : `${msg?.title ?? ''} ${msg?.body ?? ''} ${msg?.message ?? ''}`);
  });
  return { notify, sent };
}

export function makeHome() {
  const home = mkdtempSync(join(tmpdir(), 'drafta-publisher-'));
  mkdirSync(join(home, 'Library/Application Support/Drafta/site-publisher/repo'), { recursive: true });
  mkdirSync(join(home, 'Library/Application Support/Drafta/Library/notes'), { recursive: true });
  mkdirSync(join(home, 'Library/Logs'), { recursive: true });
  return {
    home,
    /** state.json wherever run.mjs keeps it under the fake home ("рядом с клоном"). */
    state() {
      const found = readdirSync(home, { recursive: true }).map(String).find((p) => p.endsWith('state.json'));
      return found ? JSON.parse(readFileSync(join(home, found), 'utf8')) : null;
    },
    logFile() {
      const file = join(home, 'Library/Logs/drafta-site-publisher.log');
      return existsSync(file) ? readFileSync(file, 'utf8') : '';
    },
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  };
}

/** Runs run.mjs once with the fakes; captures everything it writes as its log. */
export async function runPublisher({ home, clock, exec, notify, env = {}, readMtimes, ...extra }) {
  // launchd starts a fresh process per run: nothing may survive in module
  // memory, only in state.json.
  vi.resetModules();
  const mod = await importContract(RUN, '2.4');
  const run = contractFn(mod, ['run', 'default', 'main', 'runPublisher'], RUN, '2.4');
  const written = [];
  const capture = (chunk) => {
    written.push(String(chunk));
    return true;
  };
  const spies = [
    vi.spyOn(process.stdout, 'write').mockImplementation(capture),
    vi.spyOn(process.stderr, 'write').mockImplementation(capture),
    ...['log', 'info', 'warn', 'error'].map((m) => vi.spyOn(console, m).mockImplementation((...a) => capture(a.join(' ')))),
  ];
  // The exit status may come back as a return value, through process.exit or
  // through process.exitCode — all three are accepted, none is required.
  class ExitSignal extends Error {}
  let exitArg;
  spies.push(
    vi.spyOn(process, 'exit').mockImplementation((c) => {
      exitArg = c ?? 0;
      throw new ExitSignal();
    }),
  );
  const prevHome = process.env.HOME;
  const prevExitCode = process.exitCode;
  process.env.HOME = home.home;
  process.exitCode = undefined;
  const fullEnv = {
    HOME: home.home,
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
    PUBLISHER_BRANCH: 'site-publisher-test',
    ...env,
  };
  let result;
  let exitCodeSet;
  try {
    result = await run({
      exec,
      now: clock.now,
      sleep: clock.sleep,
      notify,
      env: fullEnv,
      readMtimes: readMtimes ?? (() => mtimes(T0 - 60 * MIN)),
      ...extra,
    });
  } catch (err) {
    if (!(err instanceof ExitSignal)) throw err;
  } finally {
    exitCodeSet = process.exitCode;
    process.exitCode = prevExitCode;
    process.env.HOME = prevHome;
    for (const s of spies) s.mockRestore();
  }
  const returned = typeof result === 'number' ? result : result?.exitCode ?? result?.code;
  const code = Number(returned ?? exitArg ?? exitCodeSet ?? 0);
  return { code, log: written.join('') + home.logFile(), result };
}
