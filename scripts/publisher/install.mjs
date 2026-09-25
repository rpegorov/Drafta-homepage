#!/usr/bin/env node
// Installs the publishing LaunchAgent (PLAN v2 §11.1 п. 3, 7, 10).
//
//   npm run publisher:install [-- --branch <b>]      (default branch: main)
//
// 1. clones the site from origin into ~/Library/Application Support/Drafta/
//    site-publisher/repo (or resets an existing clone to origin/<branch>) —
//    the agent runs run.mjs from that clone, never from a working copy;
// 2. proves push auth from inside launchd with a short-lived probe job and
//    prints `auth: ok`, and stops here if it is not ok;
// 3. writes ~/Library/LaunchAgents/org.drafta.site-publisher.plist and loads
//    it (a reinstall replaces the loaded job).
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { syncToOrigin } from '../lib/git.mjs';
import { bootoutIfLoaded, bootstrap } from './launchctl.mjs';
import { LABEL, PROBE_LABEL, layout } from './layout.mjs';
import { renderPlist } from './plist.mjs';
import { GIT_HOST, gitSshCommand, identityFileFor } from './ssh-key.mjs';

const execFileP = promisify(execFile);
const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const DEFAULT_BRANCH = 'main';
// Owner's decision 2026-09-25: without an IdentityFile for github.com in
// ~/.ssh/config, push authenticates with this key.
const FALLBACK_KEY = '.ssh/id_rsa';
const PROBE_TIMEOUT_MS = 45_000;
const PROBE_POLL_MS = 500;
const PROBE_VERDICT = /probe: (ok|offline|auth failed)[^\n]*/;

class InstallError extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readOptions() {
  const { values } = parseArgs({ options: { branch: { type: 'string', default: DEFAULT_BRANCH } } });
  return values;
}

/** Homebrew's versioned Cellar path breaks on upgrade; its `opt` symlink does not. */
function stableNodePath(execPath) {
  const match = execPath.match(/^(.*)\/Cellar\/([^/]+)\/[^/]+\/(.*)$/);
  if (!match) return execPath;
  const stable = `${match[1]}/opt/${match[2]}/${match[3]}`;
  return existsSync(stable) && realpathSync(stable) === realpathSync(execPath) ? stable : execPath;
}

function sshKey(home) {
  const config = join(home, '.ssh/config');
  const configured = existsSync(config) ? identityFileFor(readFileSync(config, 'utf8'), GIT_HOST, home) : null;
  const key = configured ?? join(home, FALLBACK_KEY);
  if (!existsSync(key)) throw new InstallError(`SSH key ${key} not found (set IdentityFile for Host ${GIT_HOST} in ~/.ssh/config)`);
  return key;
}

async function originUrl() {
  const { stdout } = await execFileP('git', ['remote', 'get-url', 'origin'], { cwd: REPO_ROOT });
  return stdout.trim();
}

/** A fresh clone, or the existing one reset to origin/<branch> — it holds nothing of its own. */
async function prepareClone(paths, branch, gitEnv) {
  const exec = (file, args, options) => execFileP(file, args, { ...options, env: gitEnv });
  const url = await originUrl();
  if (!existsSync(join(paths.clone, '.git'))) {
    mkdirSync(paths.base, { recursive: true });
    await exec('git', ['clone', '--quiet', '--branch', branch, url, paths.clone], {});
    return 'cloned';
  }
  await exec('git', ['remote', 'set-url', 'origin', url], { cwd: paths.clone });
  await syncToOrigin(paths.clone, branch, { exec });
  return 'reset to origin';
}

function plistValues(paths, { node, branch, gitSsh, home }) {
  return {
    LABEL,
    NODE: node,
    SCRIPT: join(paths.clone, 'scripts/publisher/run.mjs'),
    CLONE: paths.clone,
    NOTES: paths.notes,
    HOME: home,
    LIBRARY: paths.library,
    BRANCH: branch,
    GIT_SSH_COMMAND: gitSsh,
    LOG: paths.log,
  };
}

async function waitForVerdict(logFile) {
  const deadline = Date.now() + PROBE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const verdict = existsSync(logFile) ? readFileSync(logFile, 'utf8').match(PROBE_VERDICT) : null;
    if (verdict) return verdict;
    await sleep(PROBE_POLL_MS);
  }
  return null;
}

/** Runs run.mjs once as a separate launchd job with PUBLISHER_PROBE=1: same env, same session as the real agent. */
async function probeFromLaunchd(paths, values) {
  rmSync(paths.probeLog, { force: true });
  writeFileSync(paths.probePlist, renderPlist({ ...values, LABEL: PROBE_LABEL, LOG: paths.probeLog }, { PUBLISHER_PROBE: '1' }));
  await bootoutIfLoaded(PROBE_LABEL);
  await bootstrap(paths.probePlist);
  try {
    return await waitForVerdict(paths.probeLog);
  } finally {
    await bootoutIfLoaded(PROBE_LABEL);
    rmSync(paths.probePlist, { force: true });
  }
}

async function install() {
  const { branch } = readOptions();
  const env = process.env;
  const paths = layout(env);
  if (!existsSync(paths.notes)) throw new InstallError(`Drafta library not found: ${paths.notes} (set DRAFTA_LIBRARY)`);

  const key = sshKey(env.HOME);
  const gitSsh = gitSshCommand(key);
  const node = stableNodePath(process.execPath);
  console.log(`key:    ${key}`);
  console.log(`node:   ${node}`);

  const how = await prepareClone(paths, branch, { ...env, GIT_SSH_COMMAND: gitSsh, GIT_TERMINAL_PROMPT: '0' });
  console.log(`clone:  ${paths.clone} (${how}, branch ${branch})`);

  const values = plistValues(paths, { node, branch, gitSsh, home: env.HOME });
  const verdict = await probeFromLaunchd(paths, values);
  if (!verdict) throw new InstallError(`auth: unknown — the probe wrote no verdict to ${paths.probeLog} within ${PROBE_TIMEOUT_MS / 1000} s`);
  if (verdict[1] !== 'ok') throw new InstallError(`auth: failed — ${verdict[0]}`);
  console.log('auth:   ok');

  mkdirSync(dirname(paths.plist), { recursive: true });
  writeFileSync(paths.plist, renderPlist(values));
  await bootoutIfLoaded(LABEL);
  await bootstrap(paths.plist);
  console.log(`agent:  ${paths.plist} loaded — publishes to origin/${branch} after 60 s of quiet in ${paths.notes}`);
  console.log(`log:    ${paths.log}`);
}

install().catch((error) => {
  console.error(error instanceof InstallError ? error.message : `publisher:install failed: ${error.stderr?.trim() || error.message}`);
  process.exitCode = 1;
});
