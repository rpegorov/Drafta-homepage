// Git steps of a publishing run (PLAN v2 §11.3). Every function takes `exec`
// as a seam: `exec(file, args, {cwd})` resolves `{stdout}` and rejects with an
// Error carrying `code`, `stdout`, `stderr` on a non-zero exit — the shape of
// promisified `execFile`. Never `--force`, never `stash`, never a push the
// caller did not ask for.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const defaultExec = promisify(execFile);

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

/**
 * Pushes HEAD to `origin/<branch>`. Without `--force` git itself refuses
 * anything but a fast-forward, and the rejection propagates to the caller.
 */
export async function pushFastForward(dir, branch, { exec = defaultExec } = {}) {
  await git(exec, dir, ['push', '--porcelain', 'origin', `HEAD:refs/heads/${branch}`]);
  return { pushed: true };
}

/**
 * Resets the publisher's disposable clone to `origin/<branch>` before an
 * export (PLAN v2 §11.1 п. 2): its state is always derivable from origin and
 * the library, so there is nothing local to keep. For the publisher (2.4),
 * never for a working copy.
 */
export async function syncToOrigin(dir, branch, { exec = defaultExec } = {}) {
  await git(exec, dir, ['fetch', '--quiet', 'origin', branch]);
  await git(exec, dir, ['checkout', '--quiet', '-B', branch, `origin/${branch}`]);
}
