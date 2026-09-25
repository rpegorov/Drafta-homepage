/* Drafta — form validation, form messages and the one JSON call.
   Imported by page scripts; does nothing until a page calls it. */

import { DRAFTA } from '../lib/config';
import type { PostResult } from '../lib/types';
import { t, type MessageKey } from '../i18n';

type FormMessageKey = Extract<MessageKey,
  'emailRequired' | 'emailInvalid' | 'emailSpaces' | 'passwordShort' | 'passwordLong' | 'offline' | 'badResponse'>;

type SlotClass = 'form__error' | 'form__ok';

const MIN_EMAIL_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 1024;
const DEFAULT_API = 'https://api.drafta.org';

function pageLang(): string {
  const declared = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  return declared.indexOf('ru') === 0 ? 'ru' : 'en';
}

function message(key: FormMessageKey, lang?: string | null): string {
  return t(lang, key);
}

/** Mirrors the server: contains "@", no spaces, at least 3 characters. '' when valid. */
export function validateEmail(value: unknown, lang?: string | null): string {
  const email = typeof value === 'string' ? value : '';
  if (!email) return message('emailRequired', lang);
  if (/\s/.test(email)) return message('emailSpaces', lang);
  if (email.length < MIN_EMAIL_LENGTH || email.indexOf('@') === -1) return message('emailInvalid', lang);
  return '';
}

/** Mirrors the server: 8…1024 characters. '' when valid. */
export function validatePassword(value: unknown, lang?: string | null): string {
  const password = typeof value === 'string' ? value : '';
  if (password.length < MIN_PASSWORD_LENGTH) return message('passwordShort', lang);
  if (password.length > MAX_PASSWORD_LENGTH) return message('passwordLong', lang);
  return '';
}

function slot(formEl: Element | null | undefined, className: SlotClass, create: boolean): HTMLElement | null {
  if (!formEl || typeof formEl.querySelector !== 'function') return null;
  let node = formEl.querySelector<HTMLElement>('.' + className);
  if (!node && create) {
    node = document.createElement('p');
    node.className = className;
    formEl.appendChild(node);
  }
  /* Announced to screen readers the moment text lands: an error interrupts,
     a confirmation waits its turn. */
  if (node && !node.hasAttribute('role')) {
    node.setAttribute('role', className === 'form__error' ? 'alert' : 'status');
  }
  return node;
}

/** Writes .form__error inside the form and hides .form__ok. */
export function showError(formEl: Element | null | undefined, text: unknown): void {
  const node = slot(formEl, 'form__error', true);
  if (!node) return;
  node.textContent = text == null ? '' : String(text);
  node.classList.toggle('is-hidden', !node.textContent);
  const ok = slot(formEl, 'form__ok', false);
  if (ok) { ok.textContent = ''; ok.classList.add('is-hidden'); }
}

/** Removes .form__error. */
export function clearError(formEl: Element | null | undefined): void {
  const node = slot(formEl, 'form__error', false);
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

/** Writes .form__ok inside the form and hides .form__error. */
export function showOk(formEl: Element | null | undefined, text: unknown): void {
  const node = slot(formEl, 'form__ok', true);
  if (!node) return;
  node.textContent = text == null ? '' : String(text);
  node.classList.toggle('is-hidden', !node.textContent);
  const err = slot(formEl, 'form__error', false);
  if (err) { err.textContent = ''; err.classList.add('is-hidden'); }
}

function submitButton(formEl: Element | null | undefined): HTMLElement | null {
  if (!formEl || typeof formEl.querySelector !== 'function') return null;
  return formEl.querySelector<HTMLElement>('button[type="submit"]')
    || formEl.querySelector<HTMLElement>('button:not([type])')
    || formEl.querySelector<HTMLElement>('input[type="submit"]')
    || formEl.querySelector<HTMLElement>('button');
}

/** Toggles .is-busy (disabled + spinner) on the form's submit button. */
export function setBusy(formEl: Element | null | undefined, busy: boolean): void {
  const button = submitButton(formEl);
  if (!button) return;
  const on = !!busy;
  button.classList.toggle('is-busy', on);
  if ('disabled' in button) (button as HTMLButtonElement).disabled = on;
  button.setAttribute('aria-busy', on ? 'true' : 'false');
  if (formEl && formEl.setAttribute) formEl.setAttribute('aria-busy', on ? 'true' : 'false');
}

/** POST JSON to DRAFTA.api + path (or to an absolute URL). Never rejects. */
export async function post(path: string, body?: unknown, token?: string | null): Promise<PostResult> {
  const base = String(DRAFTA.api || DEFAULT_API);
  const target = /^https?:\/\//i.test(String(path || '')) ? String(path) : base + String(path || '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  let payload: string;
  try {
    payload = JSON.stringify(body == null ? {} : body);
  } catch {
    return { ok: false, status: 0, data: { error: message('badResponse', pageLang()) } };
  }

  let response: Response;
  let text: string;
  try {
    response = await fetch(target, { method: 'POST', headers, body: payload });
    text = await response.text();
  } catch {
    return { ok: false, status: 0, data: { error: message('offline', pageLang()) } };
  }

  let data: PostResult['data'] | null = null;
  if (text) {
    try { data = JSON.parse(text) as PostResult['data']; } catch { data = null; }
  }
  if (data === null) {
    data = response.ok ? {} : { error: message('badResponse', pageLang()) };
  }
  return { ok: response.ok, status: response.status, data };
}
