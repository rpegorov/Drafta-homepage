/* /account/ and /ru/account/ — licence, email and payment history of the signed-in
   account. Every value from the server goes into the page through textContent. */
import { api, endpoints } from '../../lib/config';
import { localePath } from '../../lib/lang';
import { normalizeLang, t } from '../../i18n';
import type { LicenceView, OrderRow } from '../../lib/types';
import { licenceView, orderRows } from '../account-model';
import { accessToken, clearSession, loginHref, refreshToken, signedInEmail } from '../session';
import '../session-nav';

const LANG = normalizeLang(document.documentElement.lang);
const UNAUTHORIZED = 401;
const LOGOUT_WAIT_MS = 3000;

class SessionExpired extends Error {}

function el<T extends HTMLElement = HTMLElement>(hook: string): T | null {
  return document.querySelector<T>(`[${hook}]`);
}

function setHidden(node: HTMLElement | null, hidden: boolean): void {
  if (!node) return;
  node.hidden = hidden;
  node.classList.toggle('is-hidden', hidden);
}

function setText(node: HTMLElement | null, text: string): void {
  if (node) node.textContent = text;
}

function goToLogin(): void {
  window.location.replace(loginHref(LANG, window.location.pathname));
}

/** GETs `path` with the bearer token; a 401 ends the session. Other failures throw a plain Error. */
async function getJson(path: string): Promise<unknown> {
  const response = await fetch(api + path, {
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + accessToken() },
  });
  if (response.status === UNAUTHORIZED) throw new SessionExpired();
  if (!response.ok) throw new Error('request failed: ' + response.status);
  return response.json();
}

let expired = false;

function expire(): void {
  if (expired) return;
  expired = true;
  clearSession();
  goToLogin();
}

/* ---- licence ---- */

function licenceText(view: LicenceView): string | null {
  switch (view.kind) {
    case 'trial': return t(LANG, 'accountLicenceTrial').split('{value}').join(String(view.daysLeft));
    case 'active': return t(LANG, 'accountLicenceActiveUntil').split('{value}').join(view.until);
    case 'lifetime': return t(LANG, 'accountLicenceLifetime');
    case 'expired': return t(LANG, 'accountLicenceExpired');
    default: return null;
  }
}

function showLicenceError(failed: boolean): void {
  setHidden(el('data-licence'), failed);
  setHidden(el('data-licence-error'), !failed);
}

async function loadLicence(): Promise<void> {
  setText(el('data-licence-text'), t(LANG, 'accountChecking'));
  showLicenceError(false);
  try {
    const data = await getJson(endpoints.license);
    const license = data && typeof data === 'object' ? (data as Record<string, unknown>).license : null;
    const text = licenceText(licenceView(license, LANG));
    if (text === null) { showLicenceError(true); return; }
    setText(el('data-licence-text'), text);
  } catch (error) {
    if (error instanceof SessionExpired) { expire(); return; }
    showLicenceError(true);
  }
}

/* ---- email ---- */

async function loadEmail(): Promise<void> {
  setText(el('data-account-email'), signedInEmail());
  try {
    const data = await getJson(endpoints.me);
    const me = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    if (typeof me.email === 'string' && me.email) setText(el('data-account-email'), me.email);
    setHidden(el('data-account-verified'), me.emailVerified !== true);
  } catch (error) {
    if (error instanceof SessionExpired) expire();
    /* Any other failure leaves the stored email and no verified mark: nothing is claimed. */
  }
}

/* ---- orders ---- */

function cell(text: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function orderLine(row: OrderRow): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.append(cell(row.date), cell(row.plan), cell(row.amount), cell(row.statusLabel));
  return tr;
}

function showOrders(rows: OrderRow[]): void {
  const body = el('data-orders');
  body?.replaceChildren(...rows.map(orderLine));
  setHidden(el('data-orders-table'), rows.length === 0);
  setHidden(el('data-orders-empty'), rows.length > 0);
}

function showOrdersError(failed: boolean): void {
  setHidden(el('data-orders-error'), !failed);
  if (failed) {
    setHidden(el('data-orders-table'), true);
    setHidden(el('data-orders-empty'), true);
  }
}

async function loadOrders(): Promise<void> {
  showOrdersError(false);
  try {
    const rows = orderRows(await getJson(endpoints.orders), LANG);
    if (rows === null) { showOrdersError(true); return; }
    showOrders(rows);
  } catch (error) {
    if (error instanceof SessionExpired) { expire(); return; }
    showOrdersError(true);
  }
}

/* ---- sign out ---- */

async function requestLogout(): Promise<void> {
  const refresh = refreshToken();
  if (!refresh) return;
  const request = fetch(api + endpoints.logout, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken() },
    body: JSON.stringify({ refreshToken: refresh }),
  }).catch((error: unknown) => { console.warn('Drafta: sign-out request failed', error); });
  const timeout = new Promise<void>((done) => { setTimeout(done, LOGOUT_WAIT_MS); });
  await Promise.race([request, timeout]);
}

async function logout(): Promise<void> {
  await requestLogout();
  clearSession();
  window.location.assign(localePath('/', LANG));
}

/* ---- start ---- */

function start(): void {
  if (!accessToken()) { goToLogin(); return; }
  el('data-licence-retry')?.addEventListener('click', () => { void loadLicence(); });
  el('data-orders-retry')?.addEventListener('click', () => { void loadOrders(); });
  el('data-logout')?.addEventListener('click', () => { void logout(); });
  void Promise.all([loadLicence(), loadEmail(), loadOrders()]);
}

start();
