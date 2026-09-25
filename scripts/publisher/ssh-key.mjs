// Which private key pushes to GitHub (PLAN v2 §11.1 п. 3). The installer pins
// it in GIT_SSH_COMMAND so a launchd run never depends
// on what the ssh agent happens to hold after a reboot.
import { join } from 'node:path';

export const GIT_HOST = 'github.com';
const SSH_CONNECT_TIMEOUT_S = 20;

/** ssh_config host pattern: `*` and `?` wildcards, `!` negation. */
function hostMatches(patterns, host) {
  let matched = false;
  for (const raw of patterns) {
    const negated = raw.startsWith('!');
    const glob = negated ? raw.slice(1) : raw;
    const regex = new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
    if (!regex.test(host)) continue;
    if (negated) return false;
    matched = true;
  }
  return matched;
}

function expandHome(path, home) {
  return path.startsWith('~/') ? join(home, path.slice(2)) : path;
}

/**
 * The first IdentityFile that applies to `host` in an ssh_config text, as ssh
 * itself picks it (first value wins); `Match` blocks are not evaluated.
 * @returns {string | null}
 */
export function identityFileFor(configText, host, home) {
  let applies = true;
  for (const line of configText.split('\n')) {
    const match = line.trim().match(/^(\w+)\s*=?\s*(.*)$/);
    if (!match || line.trim().startsWith('#')) continue;
    const [, keyword, value] = match;
    const key = keyword.toLowerCase();
    if (key === 'host') applies = hostMatches(value.split(/\s+/), host);
    else if (key === 'match') applies = false;
    else if (key === 'identityfile' && applies) return expandHome(value.replace(/^"|"$/g, ''), home);
  }
  return null;
}

function shellQuote(text) {
  return /^[\w@%+=:,./-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

/** Non-interactive ssh for git: no prompts, only this key, a bounded connect. */
export function gitSshCommand(keyPath) {
  return `ssh -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=${SSH_CONNECT_TIMEOUT_S} -i ${shellQuote(keyPath)}`;
}
