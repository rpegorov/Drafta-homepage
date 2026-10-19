// session.ts is the only reader and writer of the drafta_* keys.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openPage, resetScripts } from './helpers/browser.mjs';
import { accessToken, clearSession, loginHref, refreshToken, signedInEmail } from '../src/scripts/session';

const SIGNED_IN = { drafta_access: 'a1', drafta_refresh: 'r1', drafta_email: 'me@example.com' };

let page;
afterEach(() => { page?.close(); page = undefined; resetScripts(); });

async function open(storage) {
  page = await openPage({ url: 'https://drafta.org/account/', html: '<!doctype html><html><body></body></html>', storage });
}

describe('session', () => {
  it('reads the three stored values', async () => {
    await open(SIGNED_IN);
    expect([accessToken(), refreshToken(), signedInEmail()]).toEqual(['a1', 'r1', 'me@example.com']);
  });

  it('returns empty strings when nothing is stored', async () => {
    await open({});
    expect([accessToken(), refreshToken(), signedInEmail()]).toEqual(['', '', '']);
  });

  it('clears all three keys', async () => {
    await open(SIGNED_IN);
    clearSession();
    expect(localStorage.length).toBe(0);
  });

  it('survives a storage that throws', async () => {
    await open(SIGNED_IN);
    const proto = Object.getPrototypeOf(localStorage);
    const boom = () => { throw new Error('blocked'); };
    vi.spyOn(proto, 'getItem').mockImplementation(boom);
    vi.spyOn(proto, 'removeItem').mockImplementation(boom);
    try {
      expect(accessToken()).toBe('');
      expect(() => clearSession()).not.toThrow();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('builds a language-aware login address that keeps the return path', () => {
    expect(loginHref('en', '/account/')).toBe('/login/?next=%2Faccount%2F');
    expect(loginHref('ru', '/ru/account/')).toBe('/ru/login/?next=%2Fru%2Faccount%2F');
  });
});
