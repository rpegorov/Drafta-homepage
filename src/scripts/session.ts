/* The signed-in session: the one place that knows the localStorage keys.
   Every access is guarded — storage can be blocked or throw (private mode). */

import { localePath } from '../lib/lang';
import type { Lang } from '../lib/types';

export const ACCESS_KEY = 'drafta_access';
export const REFRESH_KEY = 'drafta_refresh';
export const EMAIL_KEY = 'drafta_email';

const SESSION_KEYS = [ACCESS_KEY, REFRESH_KEY, EMAIL_KEY] as const;

function read(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

export function accessToken(): string {
  return read(ACCESS_KEY);
}

export function refreshToken(): string {
  return read(REFRESH_KEY);
}

export function signedInEmail(): string {
  return read(EMAIL_KEY);
}

/** Forgets the session; a key that cannot be removed does not stop the others. */
export function clearSession(): void {
  for (const key of SESSION_KEYS) {
    try { localStorage.removeItem(key); } catch { /* storage unavailable: nothing to clear */ }
  }
}

/** The sign-in page of `lang` that returns to `nextPath` afterwards. */
export function loginHref(lang: Lang, nextPath: string): string {
  return `${localePath('/login/', lang)}?next=${encodeURIComponent(nextPath)}`;
}
