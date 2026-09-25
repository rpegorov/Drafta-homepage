/* /verify/ and /ru/verify/ — email confirmation. Ported 1:1 from the old
   inline script (commit c497677): a GET retry covers a verify endpoint that
   only exists as a GET route, and "already confirmed" is told apart from a
   fresh confirmation by inspecting the server's response. */
import { normalizeLang } from '../../i18n';
import { post } from '../forms';
import { api, endpoints } from '../../lib/config';
import type { Lang } from '../../lib/types';
import type { PostResult } from '../../lib/types';

const MESSAGES: Record<Lang, { invalid: string }> = {
  en: { invalid: 'The accounts service rejected this link.' },
  ru: { invalid: 'Служба аккаунтов отклонила эту ссылку.' },
};

type StateName = 'checking' | 'incomplete' | 'confirmed' | 'already' | 'invalid' | 'error';

const LANG = normalizeLang(document.documentElement.lang);
const MSG = MESSAGES[LANG];

const states: Record<StateName, HTMLElement | null> = {
  checking: document.querySelector('[data-state="checking"]'),
  incomplete: document.querySelector('[data-state="incomplete"]'),
  confirmed: document.querySelector('[data-state="confirmed"]'),
  already: document.querySelector('[data-state="already"]'),
  invalid: document.querySelector('[data-state="invalid"]'),
  error: document.querySelector('[data-state="error"]'),
};
const invalidReason = document.querySelector<HTMLElement>('[data-invalid-reason]');
const retryButton = document.querySelector<HTMLButtonElement>('[data-retry]');

function show(name: StateName): void {
  (Object.keys(states) as StateName[]).forEach((key) => {
    const el = states[key];
    if (!el) return;
    const visible = key === name;
    el.hidden = !visible;
    el.classList.toggle('is-hidden', !visible);
  });
}

function tokenFromQuery(): string {
  const match = /[?&]token=([^&#]*)/.exec(window.location.search);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {
    return match[1];
  }
}

function alreadyConfirmed(data: Record<string, unknown> | null | undefined): boolean {
  if (!data || typeof data !== 'object') return false;
  if (data.alreadyVerified === true || data.already_verified === true) return true;
  const words = [data.status, data.state, data.result, data.message].filter(Boolean).join(' ');
  return /already/i.test(words);
}

function settle(data: Record<string, unknown> | null | undefined): void {
  show(alreadyConfirmed(data) ? 'already' : 'confirmed');
}

function messageOf(res: { data: Record<string, unknown> | null | undefined }): string {
  return typeof res.data?.error === 'string' ? res.data.error : '';
}

function reject(res: { status: number; data: Record<string, unknown> | null | undefined } | null): void {
  if (!res || res.status === 0) {
    show('error');
    return;
  }
  if (invalidReason) invalidReason.textContent = messageOf(res) || MSG.invalid;
  show('invalid');
}

async function getOnce(path: string, token: string): Promise<PostResult> {
  const url = api + path + '?token=' + encodeURIComponent(token);
  try {
    const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    const text = await response.text();
    let data: PostResult['data'] | null = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { ok: response.ok, status: response.status, data: data ?? {} };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

if (retryButton) {
  retryButton.addEventListener('click', () => window.location.reload());
}

const token = tokenFromQuery();

if (!token) {
  show('incomplete');
} else if (!endpoints.verify) {
  show('error');
} else {
  show('checking');
  post(endpoints.verify, { token }).then((res) => {
    if (res.ok) {
      settle(res.data);
      return;
    }
    if (res.status !== 404 && res.status !== 405) {
      reject(res);
      return;
    }
    // The endpoint may exist only as a GET route; retry once, that way.
    getOnce(endpoints.verify, token).then((retried) => {
      if (retried.ok) {
        settle(retried.data);
        return;
      }
      reject(retried);
    });
  });
}
