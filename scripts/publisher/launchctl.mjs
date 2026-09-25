// launchctl steps shared by install and uninstall (user GUI domain only).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const BOOTSTRAP_ATTEMPTS = 3;
const BOOTSTRAP_RETRY_MS = 1_000;

export const guiDomain = () => `gui/${process.getuid()}`;

export async function isLoaded(label) {
  try {
    await execFileP('launchctl', ['print', `${guiDomain()}/${label}`]);
    return true;
  } catch (error) {
    // `launchctl print` exits non-zero exactly when the service is unknown.
    if (typeof error.code === 'number') return false;
    throw error;
  }
}

export async function bootoutIfLoaded(label) {
  if (await isLoaded(label)) await execFileP('launchctl', ['bootout', `${guiDomain()}/${label}`]);
}

/**
 * Right after a bootout launchd may still be tearing the old job down and
 * answer "5: Input/output error"; a short retry covers that window.
 */
export async function bootstrap(plistPath) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await execFileP('launchctl', ['bootstrap', guiDomain(), plistPath]);
      return;
    } catch (error) {
      if (attempt >= BOOTSTRAP_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, BOOTSTRAP_RETRY_MS));
    }
  }
}
