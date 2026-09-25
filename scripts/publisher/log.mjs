// The run log (PLAN v2 §11.1 п. 6). launchd sends stdout/stderr to
// ~/Library/Logs/drafta-site-publisher.log, so a line on stdout is a line in the
// log — and in the terminal for `npm run publisher:run`.
import { existsSync, renameSync, statSync } from 'node:fs';

export const MAX_LOG_BYTES = 5 * 1024 * 1024;

export function makeLogger(now) {
  return (message) => {
    process.stdout.write(`${now().toISOString()} ${message}\n`);
  };
}

/**
 * One rotation: an oversized log becomes `<log>.1`. launchd reopens the log for
 * every spawn, so the current run still writes to `.1` and the next one starts
 * a fresh file.
 */
export function rotateLog(file, maxBytes = MAX_LOG_BYTES) {
  if (existsSync(file) && statSync(file).size > maxBytes) renameSync(file, `${file}.1`);
}
