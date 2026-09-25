/* /login/ and /ru/login/ — sign-in form. Session keys, the same-site ?next=
   check and the error copy are ported 1:1 from the old inline script
   (commit c497677); only the storage keys change in wave 3. */
import { normalizeLang } from '../../i18n';
import { clearError, post, setBusy, showError, validateEmail } from '../forms';
import { endpoints } from '../../lib/config';
import type { Lang } from '../../lib/types';

const DEFAULT_NEXT = '/checkout/';

const MESSAGES: Record<Lang, {
  passwordRequired: string;
  badCredentials: string;
  failed: string;
  noSession: string;
  noStorage: string;
}> = {
  en: {
    passwordRequired: 'Enter your password.',
    badCredentials: 'Wrong email or password.',
    failed: 'Sign-in failed (HTTP {status}). Please try again.',
    noSession: 'The server accepted the sign-in but returned no session. Please try again.',
    noStorage: 'This browser blocked local storage, so the session could not be kept. Allow storage for drafta.org and try again.',
  },
  ru: {
    passwordRequired: 'Введите пароль.',
    badCredentials: 'Неверный email или пароль.',
    failed: 'Войти не удалось (HTTP {status}). Попробуйте снова.',
    noSession: 'Сервер принял вход, но не вернул сессию. Попробуйте снова.',
    noStorage: 'Браузер запретил локальное хранилище, сессию сохранить не удалось. Разрешите хранение для drafta.org и попробуйте снова.',
  },
};

function reveal(el: HTMLElement | null): void {
  if (!el) return;
  el.hidden = false;
  el.classList.remove('is-hidden');
}

function conceal(el: HTMLElement | null): void {
  if (!el) return;
  el.hidden = true;
  el.classList.add('is-hidden');
}

/* ?next= is honoured only when it is a same-site path: it must start with a
   single "/" and carry no backslash or whitespace that a browser could fold
   into a protocol-relative URL. */
function nextTarget(): string {
  const raw = /[?&]next=([^&#]*)/.exec(window.location.search)?.[1];
  if (raw === undefined) return DEFAULT_NEXT;
  let value: string;
  try {
    value = decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    value = raw;
  }
  if (value.charAt(0) !== '/' || value.charAt(1) === '/' || /[\\\s]/.test(value)) return DEFAULT_NEXT;
  return value;
}

/* The session lives in localStorage: drafta_access is the key the checkout
   page reads and drafta_email is how it names the signed-in account.
   "nostorage" and "nosession" are kept apart so the page can tell a blocked
   browser from a server that returned no tokens. */
function saveSession(data: Record<string, unknown> | null | undefined, email: string): 'ok' | 'nosession' | 'nostorage' {
  const tokens = data && typeof data === 'object' ? (data as { tokens?: { accessToken?: string; refreshToken?: string } }).tokens : null;
  if (!tokens || !tokens.accessToken) return 'nosession';
  try {
    localStorage.setItem('drafta_access', tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem('drafta_refresh', tokens.refreshToken);
    localStorage.setItem('drafta_email', email);
  } catch {
    try {
      localStorage.removeItem('drafta_access');
      localStorage.removeItem('drafta_refresh');
      localStorage.removeItem('drafta_email');
    } catch { /* nothing to do */ }
    return 'nostorage';
  }
  return 'ok';
}

function go(target: string): void {
  try {
    if (window.location && typeof window.location.assign === 'function') {
      window.location.assign(target);
      return;
    }
    if (window.location) window.location.href = target;
  } catch {
    /* the panel already on screen carries the same link */
  }
}

const LANG = normalizeLang(document.documentElement.lang);
const MSG = MESSAGES[LANG];
const form = document.querySelector<HTMLFormElement>('[data-login-form]');
const done = document.querySelector<HTMLElement>('[data-signed-in]');
const nextLink = document.querySelector<HTMLAnchorElement>('[data-next-link]');
const emailEl = document.getElementById('email') as HTMLInputElement | null;
const passwordEl = document.getElementById('password') as HTMLInputElement | null;

if (form && emailEl && passwordEl) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError(form);

    const email = emailEl.value.trim();
    const password = passwordEl.value;
    const problem = validateEmail(email, LANG) || (password ? '' : MSG.passwordRequired);

    if (problem) {
      showError(form, problem);
      return;
    }

    const target = nextTarget();
    setBusy(form, true);

    post(endpoints.login, { email, password }).then((res) => {
      setBusy(form, false);

      if (!res.ok) {
        const serverMessage = typeof res.data?.error === 'string' ? res.data.error : '';
        const rejected = res.status === 401 || res.status === 403;
        showError(form, serverMessage || (rejected ? MSG.badCredentials : MSG.failed.replace('{status}', String(res.status))));
        return;
      }

      const saved = saveSession(res.data, email);
      if (saved !== 'ok') {
        showError(form, saved === 'nostorage' ? MSG.noStorage : MSG.noSession);
        return;
      }

      reveal(done);
      if (nextLink) nextLink.setAttribute('href', target);
      conceal(form);
      go(target);
    });
  });
}
