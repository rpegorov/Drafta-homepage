// Git steps of a publishing run (PLAN v2 §11.3). Every function takes `exec`
// as a seam: `exec(file, args, {cwd})` resolves `{stdout}` and rejects with an
// Error carrying `code`, `stdout`, `stderr` on a non-zero exit — the shape of
// promisified `execFile`. Never `--force`, never `stash`, never a push the
// caller did not ask for.
import { execFile } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

export const defaultExec = promisify(execFile);
// lsof exits 1 when no process has the named file open.
const LSOF_NOTHING_OPEN = 1;

function git(exec, dir, args) {
  return exec('git', args, { cwd: dir });
}

/**
 * Files under `paths` that differ from HEAD (modified, added, deleted,
 * untracked). `git status` takes pathspecs that match nothing, which `git add`
 * does not — a page folder that never existed must not fail the run.
 */
export async function changedFiles(dir, paths, { exec = defaultExec } = {}) {
  if (paths.length === 0) return [];
  const { stdout } = await git(exec, dir, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...paths]);
  const records = stdout.split('\0').filter(Boolean);
  const files = [];
  for (let i = 0; i < records.length; i += 1) {
    const status = records[i].slice(0, 2);
    files.push(records[i].slice(3));
    // A staged rename or copy is followed by a record with its source path.
    if (status.includes('R') || status.includes('C')) files.push(records[++i]);
  }
  return files.filter(Boolean);
}

/**
 * Stages and commits only `paths`; anything else staged in `dir` stays out of
 * the commit. Nothing changed under `paths` → no commit.
 * @returns {Promise<{committed: false} | {committed: true, sha: string, files: string[]}>}
 */
export async function commitPaths(dir, paths, message, { exec = defaultExec } = {}) {
  const files = await changedFiles(dir, paths, { exec });
  if (files.length === 0) return { committed: false };
  await git(exec, dir, ['add', '-A', '--', ...files]);
  await git(exec, dir, ['commit', '-q', '-m', message, '--', ...files]);
  const { stdout } = await git(exec, dir, ['rev-parse', 'HEAD']);
  return { committed: true, sha: stdout.trim(), files };
}

/** Whether HEAD holds commits `origin/<branch>` (as last fetched) does not — e.g. after a rebase retry. */
export async function aheadOfOrigin(dir, branch, { exec = defaultExec } = {}) {
  const { stdout } = await git(exec, dir, ['rev-list', '--count', `origin/${branch}..HEAD`]);
  return Number.parseInt(stdout, 10) > 0;
}

/**
 * Pushes HEAD to `origin/<branch>`. Without `--force` git itself refuses
 * anything but a fast-forward, and the rejection propagates to the caller.
 */
export async function pushFastForward(dir, branch, { exec = defaultExec } = {}) {
  await git(exec, dir, ['push', '--porcelain', 'origin', `HEAD:refs/heads/${branch}`]);
  return { pushed: true };
}

// The directories the exporter writes; untracked leftovers there (an aborted
// run, a hand-made file) are discarded by the reset, nothing outside them is.
const CONTENT_ROOT = 'src/content';

/**
 * Resets the publisher's disposable clone to `origin/<branch>` before an
 * export (PLAN v2 §11.1 п. 2): its state is always derivable from origin and
 * the library, so there is nothing local to keep — local edits and unpushed
 * commits are dropped, not carried over (brain: `git checkout -B` onto origin
 * keeps local edits or aborts on a conflict). For the publisher (2.4), never
 * for a working copy.
 */
export async function syncToOrigin(dir, branch, { exec = defaultExec } = {}) {
  await git(exec, dir, ['fetch', '--quiet', 'origin', branch]);
  await removeStaleIndexLock(exec, dir);
  await abortRebase(exec, dir);
  await git(exec, dir, ['reset', '--hard', '--quiet', `origin/${branch}`]);
  await git(exec, dir, ['checkout', '--quiet', '-B', branch, `origin/${branch}`]);
  await git(exec, dir, ['clean', '-fd', '--quiet', '--', CONTENT_ROOT]);
}

/**
 * Replays the clone's unpushed commits onto a fresh `origin/<branch>` after a
 * rejected push, so a translation already committed is not paid for again.
 * @returns {Promise<boolean>} false when the replay conflicted — the rebase is
 *   aborted and the caller has to fall back to `syncToOrigin`.
 */
export async function rebaseOntoOrigin(dir, branch, { exec = defaultExec } = {}) {
  await git(exec, dir, ['fetch', '--quiet', 'origin', branch]);
  try {
    await git(exec, dir, ['rebase', '--quiet', `origin/${branch}`]);
    return true;
  } catch {
    await abortRebase(exec, dir);
    return false;
  }
}

/**
 * `.git/index.lock` left by a git that was killed mid-way blocks every later
 * command. It is removed only when no process holds it open (`lsof`): git
 * keeps the lock file open while it works, so an open handle means a live
 * git in this clone — the owner's, since the publisher's own lock is held.
 */
async function removeStaleIndexLock(exec, dir) {
  const lock = join(dir, '.git', 'index.lock');
  if (!existsSync(lock)) return;
  try {
    await exec('lsof', ['-t', lock], {});
    return; // exit 0: some process has it open
  } catch (error) {
    if (error.code !== LSOF_NOTHING_OPEN) throw error;
  }
  rmSync(lock, { force: true });
}

/**
 * Ends a rebase in progress — a conflicted one, or one a killed run left
 * behind, which makes every later rebase and checkout refuse. With no rebase
 * in progress git exits non-zero, and that is not an error here.
 */
async function abortRebase(exec, dir) {
  try {
    await git(exec, dir, ['rebase', '--abort']);
  } catch {
    // nothing to abort
  }
}

/** The checked-out branch, or null when HEAD is detached. */
export async function currentBranch(dir, { exec = defaultExec } = {}) {
  try {
    const { stdout } = await git(exec, dir, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
