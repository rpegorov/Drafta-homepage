// macOS notification through osascript (PLAN v2 §11.1 п. 5): runs in the
// user's launchd session, needs no signed bundle and no dependency.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const APP_TITLE = 'Drafta Publisher';
const defaultExec = promisify(execFile);

/** AppleScript string literal: backslashes and quotes escaped, line breaks flattened. */
function appleString(text) {
  return `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s*\n\s*/g, ' ')}"`;
}

/** The notification's headline is the subtitle; the app name stays the title. */
export function notificationScript({ title, body = '' }) {
  return `display notification ${appleString(body)} with title ${appleString(APP_TITLE)} subtitle ${appleString(title)}`;
}

export function notify({ title, body }, { exec = defaultExec } = {}) {
  return exec('osascript', ['-e', notificationScript({ title, body })]);
}
