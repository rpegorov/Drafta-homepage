// Translation boundaries found by the wave-2 review (PLAN v2 §11.9 rules 5–6):
// - the daily character limit, once used up, defers the translation with
//   reason `quota` while the original still ships;
// - a Russian note that failed to export is never translated (no EN file, no
//   provider request).
// The quota test drives run.mjs (which owns the daily limit) and lets its
// exporter call run the REAL CLI on a fixture world with the fake provider
// preloaded; only git and the macOS keychain/defaults are faked.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractFile } from '../helpers/contract.mjs';
import { ROOT } from '../helpers/dist.mjs';
import { EXPORTER, GIT_ENV, ID, makeWorld, runExporter, sitePost, slugs } from '../helpers/library.mjs';
import { execError, isCli, makeClock, makeExec, makeHome, makeNotify, runPublisher } from '../helpers/publisher.mjs';

const FAKE_PROVIDER = join(ROOT, 'tests/helpers/fake-provider.mjs');
const EN_FILE = 'src/content/blog/en/privet.md';
const RU_FILE = 'src/content/blog/ru/privet.md';

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
});
function world(opts) {
  const w = makeWorld(opts);
  cleanups.push(w.cleanup);
  return w;
}
function home() {
  const h = makeHome();
  cleanups.push(h.cleanup);
  return h;
}
const requestsIn = (log) => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);

const VALUE_FLAGS = new Set(['--library', '--site', '--branch']);
/** run.mjs's exporter arguments, retargeted at the test world (no push: the world has no remote). */
function retarget(args, w) {
  const at = args.findIndex((a) => a.endsWith('import-from-drafta.mjs'));
  const flags = [];
  for (let i = at + 1; i < args.length; i += 1) {
    if (VALUE_FLAGS.has(args[i])) i += 1;
    else if (args[i] !== '--push') flags.push(args[i]);
  }
  return [contractFile(EXPORTER, '2.2'), '--library', w.library, '--site', w.siteDir, ...flags];
}

/** Every exporter call made by run.mjs runs the real CLI; every JSON it printed is kept. */
function realExporter(w, providerLog) {
  const outputs = [];
  const handle = (call) => {
    if (/\bdefaults\b.*\bread\b/.test(call.line)) return /aiUseMockProvider/.test(call.line) ? '0\n' : 'anthropic\n';
    if (/\bsecurity\b.*find-generic-password/.test(call.line)) return 'sk-ant-fake\n';
    if (/rev-parse/.test(call.line)) return 'abc1234\n';
    if (!isCli(call)) return undefined;
    const env = { ...process.env, ...(call.opts.env ?? {}), ...GIT_ENV, HOME: w.home, FAKE_PROVIDER_MODE: 'echo', FAKE_PROVIDER_LOG: providerLog };
    const r = spawnSync(process.execPath, ['--import', FAKE_PROVIDER, ...retarget(call.args, w)], { cwd: ROOT, encoding: 'utf8', env, timeout: 60000 });
    try {
      outputs.push(JSON.parse(r.stdout.trim()));
    } catch {
      /* not JSON — run.mjs will see it as it is */
    }
    if (r.status !== 0) throw execError(r.stderr || 'exporter failed', { code: r.status ?? 1, stdout: r.stdout });
    return r.stdout;
  };
  return { handle, outputs };
}

describe('ЗАДАЧА-2.5 review — translation boundaries', () => {
  it('the daily character limit used up: translation deferred with reason "quota", the original is published', async () => {
    const w = world({ notes: [ID.ruOnly] });
    const h = home();
    const clock = makeClock();
    const providerLog = join(w.home, 'provider.log');
    const { handle, outputs } = realExporter(w, providerLog);
    const { exec, calls } = makeExec(clock, handle);
    const { notify } = makeNotify();
    const readDefaults = vi.fn(async (...args) => (args.includes('aiUseMockProvider') ? '0' : 'anthropic'));
    const readKey = vi.fn(async () => 'sk-ant-fake');

    await runPublisher({ home: h, clock, exec, notify, readKey, readDefaults, env: { PUBLISHER_TRANSLATE_MAX_CHARS_PER_DAY: '1' } });

    expect(calls.some(isCli), 'run.mjs never ran the exporter').toBe(true);
    expect(w.siteHas(RU_FILE), 'the original was not published').toBe(true);
    expect(w.siteHas(EN_FILE), 'translated past the daily limit').toBe(false);
    const deferred = outputs.flatMap((o) => o.translationDeferred ?? []);
    expect(deferred).toContainEqual(expect.objectContaining({ slug: 'privet', reason: 'quota' }));
    expect(requestsIn(providerLog)).toEqual([]);
  });

  it('a Russian note that failed to export (foreign draftaId, no --adopt) gets no English twin and no provider call', () => {
    const foreignFile = sitePost({ title: 'Чужой пост', slug: 'privet', lang: 'ru', draftaId: ID.foreign });
    const w = world({ notes: [ID.ruOnly], site: { [RU_FILE]: foreignFile } });
    const providerLog = join(w.home, 'provider.log');
    const env = { DRAFTA_AI_PROVIDER: 'anthropic', DRAFTA_AI_KEY: 'sk-ant-fake', FAKE_PROVIDER_MODE: 'echo', FAKE_PROVIDER_LOG: providerLog };
    const { json } = runExporter(w, ['--commit', '--translate'], { env, preload: FAKE_PROVIDER });

    expect(json.errors.length, 'the collision was not reported').toBeGreaterThan(0);
    expect(w.readSite(RU_FILE)).toBe(foreignFile);
    expect(w.siteHas(EN_FILE), 'an English twin was made from a note that did not export').toBe(false);
    expect(slugs(json.created)).not.toContain('en/privet');
    expect((json.translated ?? []).map((t) => t.slug)).not.toContain('privet');
    expect(requestsIn(providerLog)).toEqual([]);
  });
});
