// rebaseOntoOrigin (PLAN v2 §11.1 п. 2, §11.9 п. 5, review §11.10): after a
// rejected push the clone's unpushed commit (an original, or a translation
// already paid for) is replayed onto a fresh origin/<branch> — exactly once,
// never by force; a conflict aborts the rebase and leaves a clean tree so the
// caller can fall back to syncToOrigin.
// Runs real git on a temporary bare remote with two clones.
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { importContract } from '../helpers/contract.mjs';
import { git } from '../helpers/library.mjs';

const GIT_MODULE = 'scripts/lib/git.mjs';
const POST = 'src/content/blog/en/hello-world.md';
const ORIGINAL = 'src/content/blog/ru/privet.md';
const UNRELATED = 'README.md';
const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Tester',
  GIT_AUTHOR_EMAIL: 'tester@example.invalid',
  GIT_COMMITTER_NAME: 'Tester',
  GIT_COMMITTER_EMAIL: 'tester@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1',
};

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
  const root = mkdtempSync(join(tmpdir(), 'drafta-rebase-'));
  roots.push(root);
  const origin = join(root, 'origin.git');
  const other = join(root, 'other');
  mkdirSync(other);
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(other, 'init', '-q', '-b', 'main');
  write(other, POST, 'v1\n');
  write(other, UNRELATED, 'site\n');
  git(other, 'add', '-A');
  git(other, 'commit', '-q', '-m', 'seed');
  git(other, 'remote', 'add', 'origin', origin);
  git(other, 'push', '-q', 'origin', 'main');
  const clone = join(root, 'clone');
  git(root, 'clone', '-q', origin, clone);
  return { origin, clone, other };
}

/** Real git through the module's exec seam, with an identity for the replayed commits; every call is kept. */
function recordingExec() {
  const run = promisify(execFile);
  const calls = [];
  const exec = (file, args, opts = {}) => {
    calls.push([file, ...args].join(' '));
    return run(file, args, { ...opts, env: { ...process.env, ...GIT_ENV } });
  };
  return { exec, calls };
}

const usesForce = (line) => /--force|--force-with-lease|\s-f(\s|$)|\s\+\S+:/.test(line);

describe('review — rebaseOntoOrigin on real git', () => {
  it('replays the local commit onto an origin that moved on: after the push origin holds it exactly once', async () => {
    const { rebaseOntoOrigin, pushFastForward } = await importContract(GIT_MODULE, '2.2');
    const { origin, clone, other } = makeRemote();

    write(clone, ORIGINAL, 'Привет\n');
    git(clone, 'add', '-A');
    git(clone, 'commit', '-q', '-m', 'publish: Привет');

    write(other, UNRELATED, 'site, edited by hand\n');
    git(other, 'commit', '-q', '-am', 'unrelated edit on origin');
    git(other, 'push', '-q', 'origin', 'main');
    const unrelated = git(other, 'rev-parse', 'HEAD');

    const { exec, calls } = recordingExec();
    expect(await rebaseOntoOrigin(clone, 'main', { exec })).toBe(true);
    await pushFastForward(clone, 'main', { exec });

    const touching = git(origin, 'log', '--format=%H', 'main', '--', ORIGINAL).split('\n').filter(Boolean);
    expect(touching, 'origin must hold the original exactly once').toHaveLength(1);
    expect(git(origin, 'merge-base', '--is-ancestor', unrelated, 'main') === '').toBe(true);
    expect(git(origin, 'show', `main:${ORIGINAL}`)).toBe('Привет');
    expect(calls.filter(usesForce)).toEqual([]);
  });

  it('a conflicting replay returns false and leaves a clean tree with no rebase in progress', async () => {
    const { rebaseOntoOrigin } = await importContract(GIT_MODULE, '2.2');
    const { clone, other } = makeRemote();

    write(clone, POST, 'v2 from the publisher\n');
    git(clone, 'commit', '-q', '-am', 'publish: Hello world');

    write(other, POST, 'v2 from origin\n');
    git(other, 'commit', '-q', '-am', 'origin edits the same post');
    git(other, 'push', '-q', 'origin', 'main');

    const { exec, calls } = recordingExec();
    expect(await rebaseOntoOrigin(clone, 'main', { exec })).toBe(false);

    expect(git(clone, 'status', '--porcelain', '--untracked-files=all')).toBe('');
    expect(existsSync(join(clone, '.git/rebase-merge')), 'rebase-merge left behind').toBe(false);
    expect(existsSync(join(clone, '.git/rebase-apply')), 'rebase-apply left behind').toBe(false);
    expect(calls.filter(usesForce)).toEqual([]);
  });
});
