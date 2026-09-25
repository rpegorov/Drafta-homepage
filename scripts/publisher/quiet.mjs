// Waiting for the library to go quiet before a run (PLAN v2 §11.1 п. 1): the
// editor rewrites a note every ~0.5 s while the owner types, so an export
// starts only after `quietMs` without a single change under notes/ — and after
// `maxWaitMs` at the latest, so endless typing cannot postpone it forever.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const QUIET_MS = 60_000;
export const POLL_MS = 5_000;
export const MAX_WAIT_MS = 15 * 60_000;

/** Latest mtime among the values of a Map path → mtimeMs (or a plain object). */
function latestMtime(mtimes) {
  const values = mtimes instanceof Map ? [...mtimes.values()] : Object.values(mtimes);
  return values.reduce((latest, ms) => Math.max(latest, ms), Number.NEGATIVE_INFINITY);
}

/**
 * Resolves once nothing under notes/ has changed for `quietMs`.
 * @param {{readMtimes: () => Map<string, number> | Promise<Map<string, number>>, sleep: (ms: number) => Promise<void>, now: () => Date}} io
 * @returns {Promise<{waitedMs: number, timedOut: boolean}>}
 */
export async function waitForQuiet({ readMtimes, sleep, now }, { quietMs = QUIET_MS, pollMs = POLL_MS, maxWaitMs = MAX_WAIT_MS } = {}) {
  const start = now().getTime();
  for (;;) {
    const at = now().getTime();
    const waitedMs = at - start;
    if (at - latestMtime(await readMtimes()) >= quietMs) return { waitedMs, timedOut: false };
    if (waitedMs >= maxWaitMs) return { waitedMs, timedOut: true };
    await sleep(pollMs);
  }
}

/** The real `readMtimes`: the notes directory itself (entries added/removed) and every note file. */
export function notesMtimes(notesDir) {
  const mtimes = new Map([[notesDir, statSync(notesDir).mtimeMs]]);
  for (const name of readdirSync(notesDir)) {
    const path = join(notesDir, name);
    try {
      mtimes.set(path, statSync(path).mtimeMs);
    } catch (error) {
      // A note removed between readdir and stat already moved the directory's
      // own mtime, which is in the map.
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return mtimes;
}
