// One run at a time per clone. launchd never overlaps its own job, but a
// manual `npm run publisher:run` can meet a launchd run in the same working
// tree, and two git processes there would fight over index.lock.
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

function holder(file) {
  try {
    return Number.parseInt(readFileSync(file, 'utf8'), 10);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Takes the lock, or reports the live process that holds it. A lock left by a
 * crashed run (its pid is gone) is taken over.
 * @returns {{acquired: true} | {acquired: false, pid: number}}
 */
export function acquireLock(file, pid = process.pid) {
  mkdirSync(dirname(file), { recursive: true });
  for (;;) {
    try {
      writeFileSync(file, String(pid), { flag: 'wx' });
      return { acquired: true };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const owner = holder(file);
    if (owner && owner !== pid && isAlive(owner)) return { acquired: false, pid: owner };
    rmSync(file, { force: true });
  }
}

export function releaseLock(file, pid = process.pid) {
  if (holder(file) === pid) rmSync(file, { force: true });
}
