// The run lock (scripts/publisher/lock.mjs, review §11.10) names its holder by
// pid AND start time. Both runs are separate node processes with the real `ps`
// lookup, exactly as launchd and a manual `npm run publisher:run` meet:
// - a live holder is recognised whatever locale either process runs in
//   (launchd starts with LANG unset/C, a terminal with ru_RU.UTF-8);
// - a live pid that now belongs to a different process is a stale lock.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { contractFile } from '../helpers/contract.mjs';

const LOCK_MODULE = 'scripts/publisher/lock.mjs';
const C = { LANG: 'C', LC_ALL: 'C', LC_TIME: 'C' };
const RU = { LANG: 'ru_RU.UTF-8', LC_ALL: 'ru_RU.UTF-8', LC_TIME: 'ru_RU.UTF-8' };

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
});

function tempLock() {
  const dir = mkdtempSync(join(tmpdir(), 'drafta-lock-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'run.lock');
}

/** A live process that is not a publisher run; killed after the test. */
function liveProcess() {
  const child = spawn('/bin/sleep', ['120'], { stdio: 'ignore' });
  cleanups.push(() => child.kill('SIGKILL'));
  return child.pid;
}

/**
 * acquireLock in a fresh node process under `locale`.
 * @param {number} [asPid] take the lock on behalf of this pid (default: the child's own)
 */
function acquireIn(locale, file, asPid) {
  const url = pathToFileURL(contractFile(LOCK_MODULE, '2.4')).href;
  const pidArg = asPid === undefined ? 'process.pid' : String(asPid);
  const code = `const m = await import(${JSON.stringify(url)}); console.log(JSON.stringify(m.acquireLock(${JSON.stringify(file)}, ${pidArg})));`;
  const env = { ...process.env, ...locale };
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', env, timeout: 30000 });
  if (r.status !== 0) throw new Error(`acquireLock child failed: ${r.stderr}`);
  return JSON.parse(r.stdout.trim());
}

describe('review — run lock', () => {
  it('a lock written under LANG=C is live for a run under ru_RU.UTF-8, and the other way round', () => {
    for (const [writer, checker] of [
      [C, RU],
      [RU, C],
    ]) {
      const file = tempLock();
      const holder = liveProcess();
      expect(acquireIn(writer, file, holder)).toEqual({ acquired: true });

      const second = acquireIn(checker, file);
      expect(second, `${writer.LANG} holder taken for stale by a ${checker.LANG} run`).toEqual({ acquired: false, pid: holder });
    }
  });

  it('a lock whose pid is alive but belongs to a process started at another time is stale', () => {
    const file = tempLock();
    // Written for pid 1 (launchd, started at boot), then the pid is swapped for
    // a process started just now — the pid-reuse case after a reboot.
    expect(acquireIn(C, file, 1)).toEqual({ acquired: true });
    const record = JSON.parse(readFileSync(file, 'utf8'));
    const reused = liveProcess();
    writeFileSync(file, JSON.stringify({ ...record, pid: reused }));

    expect(acquireIn(C, file)).toEqual({ acquired: true });
  });
});
