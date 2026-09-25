// state.json next to the clone (PLAN v2 §11.1 п. 4): the only memory that
// survives between launchd runs — every run is a fresh process.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const EMPTY_STATE = Object.freeze({ lastNotifiedReason: null, lastNotifiedAt: null, announcedProblems: [] });

/**
 * A missing file is an empty state. A corrupt one is too — it must not stop
 * publishing, the worst case is one repeated notification — but the caller
 * gets the reason to log.
 * @returns {{state: object, warning?: string}}
 */
export function readState(file) {
  if (!existsSync(file)) return { state: { ...EMPTY_STATE } };
  try {
    return { state: { ...EMPTY_STATE, ...JSON.parse(readFileSync(file, 'utf8')) } };
  } catch (error) {
    return { state: { ...EMPTY_STATE }, warning: `state.json unreadable, starting empty: ${error.message}` };
  }
}

export function writeState(file, state) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temp, file);
}

/** Whether a throttled notification for `reason` may go out now. */
export function mayNotify(state, reason, at, intervalMs) {
  if (state.lastNotifiedReason !== reason || !state.lastNotifiedAt) return true;
  return at.getTime() - Date.parse(state.lastNotifiedAt) >= intervalMs;
}

export function markNotified(state, reason, at) {
  return { ...state, lastNotifiedReason: reason, lastNotifiedAt: at.toISOString() };
}
