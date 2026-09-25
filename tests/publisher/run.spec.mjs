// ЗАДАЧА-2.4 — the publish watcher (PLAN v2 §11.1 п. 1–7, §11.4, §11.5).
// run.mjs is driven with fake exec/now/sleep/notify/readMtimes; the exporter is
// reached only through its CLI JSON contract, so every CLI call here is a fake
// answer in that contract's shape.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { contractFile } from '../helpers/contract.mjs';
import { ROOT } from '../helpers/dist.mjs';
import {
  MIN,
  POST,
  T0,
  cliJson,
  execError,
  isCli,
  isFetch,
  isPublish,
  isPushAttempt,
  makeClock,
  makeExec,
  makeHome,
  makeNotify,
  mtimes,
  runPublisher,
  usesForce,
} from '../helpers/publisher.mjs';

const homes = [];
function home() {
  const h = makeHome();
  homes.push(h);
  return h;
}
afterEach(() => {
  while (homes.length) homes.pop().cleanup();
});

const PUBLISHED = cliJson({ created: [POST], committed: true, sha: 'abc1234', pushed: true });
const OFFLINE = 'ssh: Could not resolve hostname github.com: nodename nor servname provided, or not known\nfatal: Could not read from remote repository.';
const REJECTED = ' ! [rejected]        site-publisher-test -> site-publisher-test (fetch first)\nerror: failed to push some refs';

/** Everything succeeds; the publishing CLI call answers `publishOut`, a dry run finds nothing. */
function happy(publishOut = PUBLISHED) {
  return (call) => {
    if (isCli(call)) return isPublish(call) ? publishOut : cliJson();
    if (/rev-parse/.test(call.line)) return 'abc1234\n';
    return undefined;
  };
}

/** Push attempts fail while `rejectPush(n)` is true for the n-th attempt (1-based). */
function pushRace(rejectPush) {
  let attempts = 0;
  return (call) => {
    if (!isPushAttempt(call)) return happy(cliJson({ created: [POST], committed: true, sha: 'abc1234', pushed: false }))(call);
    attempts += 1;
    const reject = rejectPush(attempts);
    if (!isCli(call)) {
      if (reject) throw execError(REJECTED, { code: 1 });
      return undefined;
    }
    if (!reject) return PUBLISHED;
    throw execError('push rejected', {
      code: 1,
      stdout: cliJson({ created: [POST], committed: true, sha: 'abc1234', pushed: false, errors: [{ title: 'git push', message: REJECTED }] }),
    });
  };
}

describe('ЗАДАЧА-2.4 publisher', () => {
  it('[wiring] npm scripts, the launchd plist and the install probe are in place', async () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    for (const name of ['publisher:install', 'publisher:uninstall', 'publisher:run']) {
      const script = pkg.scripts?.[name] ?? '';
      const target = script.match(/scripts\/publisher\/[\w.-]+\.mjs/)?.[0];
      expect(target, `package.json "${name}" does not run a scripts/publisher/*.mjs file`).toBeTruthy();
      contractFile(target, '2.4');
    }
    const plist = readFileSync(contractFile('scripts/publisher/plist.template.xml', '2.4'), 'utf8');
    expect(plist).toMatch(/<key>WatchPaths<\/key>/);
    expect(plist).toMatch(/<key>RunAtLoad<\/key>\s*<true\s*\/>/);
    expect(plist).toMatch(/<key>StartInterval<\/key>\s*<integer>1800<\/integer>/);
    expect(plist).toMatch(/<key>ThrottleInterval<\/key>\s*<integer>60<\/integer>/);
    expect(plist).not.toMatch(/KeepAlive/);
    // Owner's decision 2026-09-25: push authenticates with ~/.ssh/id_rsa.
    const install = readFileSync(contractFile('scripts/publisher/install.mjs', '2.4'), 'utf8');
    expect(plist + install).toMatch(/\.ssh\/id_rsa\b/);
    expect(plist).not.toMatch(/id_ed25519/);

    const h = home();
    const clock = makeClock();
    const { exec, calls } = makeExec(clock, happy());
    const { notify } = makeNotify();
    const { code, log } = await runPublisher({ home: h, clock, exec, notify, env: { PUBLISHER_PROBE: '1' } });
    expect(code).toBe(0);
    expect(calls.length, 'probe ran no git command').toBeGreaterThan(0);
    expect(calls.map((c) => c.line).filter((l) => !/ls-remote/.test(l))).toEqual([]);
    expect(log).toMatch(/probe: ok/);
  });

  it('after 60 s of quiet it runs the exporter once and notifies "Опубликовано" with the post title', async () => {
    const h = home();
    const clock = makeClock();
    const { exec, calls } = makeExec(clock, happy());
    const { notify, sent } = makeNotify();
    const { code } = await runPublisher({ home: h, clock, exec, notify, readMtimes: () => mtimes(T0) });
    expect(code).toBe(0);
    const publishes = calls.filter(isPublish);
    expect(publishes).toHaveLength(1);
    expect(publishes[0].line).toContain('--json');
    expect(publishes[0].at - T0).toBeGreaterThanOrEqual(60_000);
    expect(publishes[0].at - T0).toBeLessThanOrEqual(70_000);
    expect(sent.some((m) => /Опубликовано/.test(m) && m.includes(POST.title)), sent.join(' | ')).toBe(true);
  });

  it('offline: fetch fails → "deferred: offline", no publishing run, exit 0', async () => {
    const h = home();
    const clock = makeClock();
    const { exec, calls } = makeExec(clock, (call) => {
      if (isFetch(call)) throw execError(OFFLINE, { code: 128 });
      return happy()(call);
    });
    const { notify } = makeNotify();
    const { code, log } = await runPublisher({ home: h, clock, exec, notify });
    expect(code).toBe(0);
    expect(calls.filter(isPublish)).toEqual([]);
    expect(log).toMatch(/deferred: offline/);
  });

  it('a rejected push is retried once after a fresh fetch and then succeeds', async () => {
    const h = home();
    const clock = makeClock();
    const { exec, calls } = makeExec(clock, pushRace((n) => n === 1));
    const { notify, sent } = makeNotify();
    const { code } = await runPublisher({ home: h, clock, exec, notify });
    expect(code).toBe(0);
    const pushes = calls.map((c, i) => ({ c, i })).filter(({ c }) => isPushAttempt(c));
    expect(pushes).toHaveLength(2);
    const fetchBetween = calls.slice(pushes[0].i + 1, pushes[1].i).some(isFetch);
    expect(fetchBetween, 'no git fetch between the rejected push and the retry').toBe(true);
    expect(calls.filter(usesForce)).toEqual([]);
    expect(sent.some((m) => /Опубликовано/.test(m)), sent.join(' | ')).toBe(true);
  });
});

describe('ЗАДАЧА-2.4 publisher — failures', () => {
  it('typing keeps it waiting, yet after 15 minutes the run happens anyway', async () => {
    const h = home();
    const clock = makeClock();
    const { exec, calls } = makeExec(clock, happy());
    const { notify } = makeNotify();
    // Every poll sees a fresh mtime — the editor saves every few seconds.
    await runPublisher({ home: h, clock, exec, notify, readMtimes: () => mtimes(clock.ms) });
    const publishes = calls.filter(isPublish);
    expect(publishes).toHaveLength(1);
    expect(publishes[0].at - T0).toBeGreaterThanOrEqual(15 * MIN);
    expect(publishes[0].at - T0).toBeLessThanOrEqual(15 * MIN + 70_000);
  });

  it('a second push rejection stops with "origin ушёл вперёд", exit 1, and never forces', async () => {
    const h = home();
    const clock = makeClock();
    const { exec, calls } = makeExec(clock, pushRace(() => true));
    const { notify, sent } = makeNotify();
    const { code } = await runPublisher({ home: h, clock, exec, notify });
    expect(code).toBe(1);
    expect(calls.filter(isPushAttempt)).toHaveLength(2);
    expect(calls.filter(usesForce)).toEqual([]);
    expect(sent.some((m) => /origin ушёл вперёд/i.test(m)), sent.join(' | ')).toBe(true);
  });

  it('exporter errors[] are notified with their reason while the rest is still announced', async () => {
    const h = home();
    const clock = makeClock();
    const out = cliJson({
      created: [POST],
      errors: [{ title: 'Broken attachment', message: 'attachment missing: nope.png' }],
      committed: true,
      sha: 'abc1234',
      pushed: true,
    });
    const { exec } = makeExec(clock, (call) => {
      if (isPublish(call)) throw execError('export finished with errors', { code: 1, stdout: out });
      return happy()(call);
    });
    const { notify, sent } = makeNotify();
    await runPublisher({ home: h, clock, exec, notify });
    expect(sent.some((m) => m.includes('Broken attachment') && m.includes('nope.png')), sent.join(' | ')).toBe(true);
    expect(sent.some((m) => /Опубликовано/.test(m) && m.includes(POST.title)), sent.join(' | ')).toBe(true);
  });

  it('"нет сети" is notified at most once an hour across runs', async () => {
    const h = home();
    const perRun = [];
    for (const at of [T0, T0 + 30 * MIN, T0 + 61 * MIN]) {
      const clock = makeClock(at);
      const { exec } = makeExec(clock, (call) => {
        if (isFetch(call)) throw execError(OFFLINE, { code: 128 });
        // A dry run over the stale clone still sees a pending post.
        if (isCli(call) && !isPublish(call)) return cliJson({ created: [POST] });
        return happy()(call);
      });
      const { notify, sent } = makeNotify();
      await runPublisher({ home: h, clock, exec, notify });
      perRun.push(sent.filter((m) => /нет сети/i.test(m)).length);
    }
    expect(perRun).toEqual([1, 0, 1]);
  });
});
