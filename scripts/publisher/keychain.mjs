// Drafta's AI provider and key, read the way PLAN v2 §11.9 decides: the
// provider from Drafta's defaults, the key from the login keychain through the
// Apple-signed /usr/bin/security. The first read shows the system dialog once
// (the installer asks the owner to press "Always Allow"); after that
// /usr/bin/security is in the item's ACL and launchd runs read silently.
// The key is returned to the caller only — never logged, never put in argv.

export const DRAFTA_DEFAULTS_DOMAIN = 'rostislav.egorov.Drafta';
export const DRAFTA_KEY_SERVICE = 'com.drafta.ai.providers';
// The installer's `--own-ai-key` item: created with /usr/bin/security in its
// ACL, so it is read without any dialog. It wins over Drafta's item.
export const OWN_KEY_SERVICE = 'org.drafta.site-publisher';
export const SECURITY = '/usr/bin/security';
const DEFAULTS = '/usr/bin/defaults';
export const KEY_READ_TIMEOUT_MS = 15_000;
// `security` exit status for errSecItemNotFound.
const ITEM_NOT_FOUND = 44;

export class KeychainError extends Error {}

/** One key of Drafta's defaults, or null when it is not set. */
export async function readDraftaDefault(exec, key) {
  try {
    const { stdout } = await exec(DEFAULTS, ['read', DRAFTA_DEFAULTS_DOMAIN, key]);
    const value = String(stdout).trim();
    return value || null;
  } catch {
    // `defaults read` exits 1 for a missing domain or key — "not set".
    return null;
  }
}

async function readItem(exec, service, account) {
  try {
    const { stdout } = await exec(SECURITY, ['find-generic-password', '-s', service, '-a', account, '-w'], { timeout: KEY_READ_TIMEOUT_MS });
    return String(stdout).trim() || null;
  } catch (error) {
    if (error?.code === ITEM_NOT_FOUND) return null;
    const why = error?.killed ? `no answer within ${KEY_READ_TIMEOUT_MS / 1000} s (the Keychain dialog was not answered)` : `security exited ${error?.code ?? 'abnormally'}`;
    throw new KeychainError(`keychain: ${service} → ${why}`);
  }
}

/**
 * The provider's API key: the publisher's own item first, then Drafta's.
 * @returns {Promise<string|null>} null when neither item exists
 * @throws {KeychainError} the read was denied or timed out (message has no key)
 */
export async function readProviderKey(exec, provider) {
  return (await readItem(exec, OWN_KEY_SERVICE, provider)) ?? (await readItem(exec, DRAFTA_KEY_SERVICE, provider));
}

export const AI_SKIP = Object.freeze({ mock: 'mock', noProvider: 'no-provider', noKey: 'no-key', keychain: 'keychain' });
const TRUE_DEFAULTS = new Set(['1', 'true', 'YES', 'yes']);

/**
 * What this run can translate with.
 * @param {{readDefaults: (key: string) => Promise<string|null>, readKey: (provider: string) => Promise<string|null>,
 *   providers: string[]}} io
 * @returns {Promise<{provider: string, key: string} | {skip: string, detail: string}>}
 */
export async function resolveAi({ readDefaults, readKey, providers }) {
  if (TRUE_DEFAULTS.has(String((await readDefaults('aiUseMockProvider')) ?? '').trim())) {
    return { skip: AI_SKIP.mock, detail: 'Drafta uses its mock AI provider' };
  }
  const provider = String((await readDefaults('aiActiveProvider')) ?? '').trim();
  if (!providers.includes(provider)) return { skip: AI_SKIP.noProvider, detail: provider ? `unknown provider "${provider}"` : 'no provider chosen in Drafta' };
  let key;
  try {
    key = await readKey(provider);
  } catch (error) {
    const detail = error instanceof KeychainError ? error.message : `keychain: ${error?.killed ? 'timed out' : 'read failed'}`;
    return { skip: AI_SKIP.keychain, detail };
  }
  if (!key) return { skip: AI_SKIP.noKey, detail: `no ${provider} key in Drafta` };
  return { provider, key: String(key).trim() };
}
