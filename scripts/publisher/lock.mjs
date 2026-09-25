// One run at a time per clone. launchd never overlaps its own job, but a
// manual `npm run publisher:run` can meet a launchd run in the same working
// tree, and two git processes there would fight over index.lock.
//
// The lock names its holder by pid AND process start time: after a reboot or
// a crash the pid is reused by an unrelated process, which a pid-only check
// takes for a live run forever.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else — still alive.
    return error.code === 'EPERM';
  }
}

/** `ps` start time of a process, or null when there is none. */
export function processStartTime(pid) {
  try {
    const out = execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/** @returns {{pid: number, startedAt: string|null} | null} null when there is no lock file */
function holder(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  try {
    const parsed = JSON.parse(text);
    return { pid: Number(parsed.pid), startedAt: parsed.startedAt ?? null };
  } catch {
    // A lock written before start times were recorded: pid only.
    return { pid: Number.parseInt(text, 10), startedAt: null };
  }
}

function holderIsRunning(owner, startOf) {
  if (!Number.isInteger(owner.pid) || !isAlive(owner.pid)) return false;
  if (!owner.startedAt) return true;
  return startOf(owner.pid) === owner.startedAt;
}

/**
 * Takes the lock, or reports the live process that holds it. A lock left by a
 * crashed run (its pid is gone, or now belongs to a different process) is taken over.
 * @param {(pid: number) => string|null} [startOf] process start time lookup (injected in tests)
 * @returns {{acquired: true} | {acquired: false, pid: number}}
 */
export function acquireLock(file, pid = process.pid, startOf = processStartTime) {
  mkdirSync(dirname(file), { recursive: true });
  const record = JSON.stringify({ pid, startedAt: startOf(pid) });
  for (;;) {
    try {
      writeFileSync(file, record, { flag: 'wx' });
      return { acquired: true };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const owner = holder(file);
    if (owner && owner.pid !== pid && holderIsRunning(owner, startOf)) return { acquired: false, pid: owner.pid };
    rmSync(file, { force: true });
  }
}

export function releaseLock(file, pid = process.pid) {
  if (holder(file)?.pid === pid) rmSync(file, { force: true });
}
