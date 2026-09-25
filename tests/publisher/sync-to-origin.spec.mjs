// syncToOrigin (PLAN v2 §11.1 п. 2, §11.3 git-module contract): the publisher's
// clone is disposable, so a sync makes it equal to origin/<branch> whatever is
// left in it — uncommitted edits, untracked files, and an edit to a file that
// origin has since changed (a plain `checkout -B` aborts there, see brain
// gotchas/git-checkout-b-onto-origin-does-not-reset-a-disposable-clone).
// Runs real git on a temporary bare remote with two clones.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { importContract } from '../helpers/contract.mjs';
import { git } from '../helpers/library.mjs';

const GIT_MODULE = 'scripts/lib/git.mjs';
const POST = 'src/content/blog/en/hello-world.md';
const STRAY = 'src/content/blog/en/stray-post.md';

const roots = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

function write(dir, rel, text) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

/** A bare origin with one commit on main, the publisher's clone, and a second writer's clone. */
function makeRemote() {
  const root = mkdtempSync(join(tmpdir(), 'drafta-sync-'));
  roots.push(root);
  const origin = join(root, 'origin.git');
  const seed = join(root, 'seed');
  mkdirSync(seed);
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(seed, 'init', '-q', '-b', 'main');
  write(seed, POST, 'v1\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'remote', 'add', 'origin', origin);
  git(seed, 'push', '-q', 'origin', 'main');
  const clone = join(root, 'clone');
  git(root, 'clone', '-q', origin, clone);
  return { origin, clone, other: seed };
}

describe('ЗАДАЧА-2.2 review — syncToOrigin on real git', () => {
  it('drops uncommitted edits and untracked files in src/content and survives a conflict with origin', async () => {
    const { syncToOrigin } = await importContract(GIT_MODULE, '2.2');
    const { clone, other } = makeRemote();

    write(other, POST, 'v2 from origin\n');
    git(other, 'commit', '-q', '-am', 'origin moves on');
    git(other, 'push', '-q', 'origin', 'main');

    write(clone, POST, 'local uncommitted edit\n');
    write(clone, STRAY, 'left over by a crashed run\n');

    await syncToOrigin(clone, 'main');

    expect(readFileSync(join(clone, POST), 'utf8')).toBe('v2 from origin\n');
    expect(git(clone, 'status', '--porcelain', '--untracked-files=all')).toBe('');
    expect(git(clone, 'rev-parse', 'HEAD')).toBe(git(other, 'rev-parse', 'HEAD'));
  });
});
