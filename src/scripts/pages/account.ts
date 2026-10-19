/* /account/ and /ru/account/ — licence, email and payment history of the signed-in
   account. Every value from the server goes into the page through textContent. */
import { api, endpoints } from '../../lib/config';
import { localePath } from '../../lib/lang';
import { normalizeLang, t } from '../../i18n';
import type { AutoRenewView, LicenceView, OrderRow } from '../../lib/types';
import { autoRenewView, licenceView, orderRows } from '../account-model';
import { loadAutoRenewAvailable } from '../plans';
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

/* ---- auto-renewal ---- */

const PAST_DUE_KEYS = {
  failures: 'accountAutoRenewPastDue',
  price_changed: 'accountAutoRenewPriceChanged',
  plan_unavailable: 'accountAutoRenewPlanUnavailable',
  expired: 'accountAutoRenewExpired',
  other: 'accountAutoRenewPastDue',
} as const;
const CANCEL_KEYS = {
  user: 'accountAutoRenewCancelled',
  superseded: 'accountAutoRenewCancelled',
  plan_switched: 'accountAutoRenewPlanSwitched',
  other: 'accountAutoRenewCancelled',
} as const;

/** Main status line: what auto-renewal is doing, given whether the server runs charges at all. */
function autoRenewText(view: AutoRenewView, chargesRun: boolean): string {
  switch (view.kind) {
    case 'off': return t(LANG, 'accountAutoRenewOff');
    case 'past_due': return t(LANG, PAST_DUE_KEYS[view.reason]);
    case 'cancelled': return t(LANG, CANCEL_KEYS[view.reason]);
    case 'active':
      if (!chargesRun) return t(LANG, 'accountAutoRenewPaused');
      if (view.inFlight) return t(LANG, 'accountAutoRenewInFlight');
      return view.next ? t(LANG, 'accountAutoRenewActive').split('{value}').join(view.next) : '';
  }
}

function renewNoteText(view: AutoRenewView): string {
  if (view.kind === 'active') return t(LANG, 'accountAutoRenewInFlightRenewNote').split('{amount}').join(view.amount);
  return t(LANG, 'accountAutoRenewInFlight');
}

/** Marks the renew buttons while a charge is in progress: a manual payment would add a second period. */
function markRenewButtons(note: string | null): void {
  setText(el('data-renew-note'), note ?? '');
  setHidden(el('data-renew-note'), note === null);
  const noteId = el('data-renew-note')?.id ?? '';
  for (const button of document.querySelectorAll<HTMLElement>('[data-renew]')) {
    if (note === null) button.removeAttribute('aria-describedby');
    else button.setAttribute('aria-describedby', noteId);
  }
}

function showAutoRenew(view: AutoRenewView, chargesRun: boolean): void {
  const active = view.kind === 'active';
  const inFlight = view.kind !== 'off' && view.inFlight;
  const text = autoRenewText(view, chargesRun);
  const flightLine = inFlight && !(active && chargesRun);
  setText(el('data-autorenew-text'), text);
  setHidden(el('data-autorenew-text'), text === '');
  setText(el('data-autorenew-detail'), active ? `${view.plan} · ${view.amount}` : '');
  setHidden(el('data-autorenew-detail'), !active);
  setText(el('data-autorenew-flight'), flightLine ? t(LANG, 'accountAutoRenewInFlight') : '');
  setHidden(el('data-autorenew-flight'), !flightLine);
  setHidden(el('data-autorenew-cancel'), !active);
  setHidden(el('data-autorenew-cancel-error'), true);
  setHidden(el('data-autorenew-error'), true);
  setHidden(el('data-autorenew-block'), false);
  markRenewButtons(inFlight ? renewNoteText(view) : null);
}

function showAutoRenewError(): void {
  setHidden(el('data-autorenew-block'), false);
  for (const hook of ['data-autorenew-text', 'data-autorenew-detail', 'data-autorenew-flight', 'data-autorenew-cancel', 'data-autorenew-cancel-error']) {
    setHidden(el(hook), true);
  }
  setHidden(el('data-autorenew-error'), false);
  markRenewButtons(null);
}

/** The block exists only when charges are offered or the account already has a record. */
async function loadAutoRenew(): Promise<void> {
  const availability = loadAutoRenewAvailable();
  try {
    const data = await getJson(endpoints.autorenew);
    const available = await availability;
    const record = data && typeof data === 'object' ? (data as Record<string, unknown>).autoRenew : undefined;
    const view = autoRenewView(record, LANG);
    if (view === null) { if (available) showAutoRenewError(); return; }
    if (view.kind === 'off' && !available) { setHidden(el('data-autorenew-block'), true); return; }
    showAutoRenew(view, available);
  } catch (error) {
    if (error instanceof SessionExpired) { expire(); return; }
    console.warn('Drafta: auto-renewal could not be loaded', error);
    if (await availability) showAutoRenewError();
  }
}

async function cancelAutoRenew(): Promise<void> {
  const message = `${t(LANG, 'accountAutoRenewCancelConfirm')} ${t(LANG, 'accountAutoRenewCancelInFlightNote')}`;
  if (!window.confirm(message)) return;
  const button = el<HTMLButtonElement>('data-autorenew-cancel');
  if (button) button.disabled = true;
  try {
    const response = await fetch(api + endpoints.autorenewCancel, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + accessToken() },
    });
    if (response.status === UNAUTHORIZED) { expire(); return; }
    if (!response.ok) throw new Error('request failed: ' + response.status);
    await loadAutoRenew();
  } catch {
    setHidden(el('data-autorenew-cancel-error'), false);
  } finally {
    if (button) button.disabled = false;
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
  el('data-autorenew-retry')?.addEventListener('click', () => { void loadAutoRenew(); });
  el('data-autorenew-cancel')?.addEventListener('click', () => { void cancelAutoRenew(); });
  el('data-logout')?.addEventListener('click', () => { void logout(); });
  void Promise.all([loadLicence(), loadEmail(), loadOrders(), loadAutoRenew()]);
}

start();
