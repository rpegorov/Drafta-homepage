/* Drafta — checkout page script. `renderPlans` owns everything inside
   [data-plans], this script owns #order-form and everything in it. The page
   never holds a price of its own and never reports a purchase: choosing a plan
   only asks the API for a payment URL and sends the buyer there. */

import { renderPlans, loadPlans, loadAutoRenewAvailable, formatStorage, formatNotes } from '../plans';
import { post, showError, showOk } from '../forms';
import { accessToken, signedInEmail, loginHref } from '../session';
import { endpoints } from '../../lib/config';
import { t } from '../../i18n';
import type { Lang, Plan, PostResult } from '../../lib/types';

function pageLang(): Lang {
  const declared = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  return declared.indexOf('ru') === 0 ? 'ru' : 'en';
}

const LANG: Lang = pageLang();

/* The login page returns here with the query intact, so a ?plan= the app or a
   pricing card opened with survives the sign-in. */
const LOGIN_URL = loginHref(LANG, location.pathname + location.search);
/* The access token is written only by /login/, so a sessionless buyer goes
   there. /register/ would answer 409 for a returning customer. */

function fill(template: string, value: string): string {
  return String(template).split('{value}').join(value);
}

const plansEl = document.querySelector<HTMLElement>('[data-plans]');
const formEl = document.getElementById('order-form');
const hintEl = document.getElementById('order-hint');
const loginEl = document.getElementById('order-login');
const autoRenewEl = document.getElementById('order-autorenew');
const autoRenewInput = document.getElementById('order-autorenew-input') as HTMLInputElement | null;
if (loginEl) loginEl.setAttribute('href', LOGIN_URL);

function show(el: HTMLElement | null): void { if (el) { el.hidden = false; el.classList.remove('is-hidden'); } }
function hide(el: HTMLElement | null): void { if (el) { el.hidden = true; el.classList.add('is-hidden'); } }
function say(el: HTMLElement | null, text: string): void { if (el) el.textContent = text; }

function setError(text: string): void { showError(formEl, text); }
function clearMessages(): void { showError(formEl, ''); showOk(formEl, ''); }

/* The card's own CTA is the purchase action, so the busy state lives on the
   button that was pressed rather than on a form-wide submit button. */
function busy(button: HTMLElement | null, on: boolean): void {
  if (!button) return;
  (button as HTMLButtonElement).disabled = !!on;
  button.classList.toggle('is-busy', !!on);
  button.setAttribute('aria-busy', on ? 'true' : 'false');
}

function initSession(): void {
  if (accessToken()) {
    const email = signedInEmail();
    say(hintEl, email ? fill(t(LANG, 'checkoutSignedInAs'), email) : t(LANG, 'checkoutSignedIn'));
    hide(loginEl);
  } else {
    say(hintEl, t(LANG, 'checkoutNeedsAccount'));
    show(loginEl);
  }
}

let sending = false;
let autoRenewOffered = false;

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

/* A server error with a JSON `error` keeps its own text; a plain-text or empty
   5xx body (e.g. the shop is not configured) gets the honest availability line. */
function failureText(res: PostResult, status: number): string {
  if (status >= 500 && (res.unparsed || !res.data.error)) return t(LANG, 'checkoutUnavailable');
  if (res.data.error) return String(res.data.error);
  return t(LANG, 'checkoutNetwork') + ' (HTTP ' + status + ')';
}

/* Choosing a plan needs a session; without one the buyer goes to /login/. */
function subscribe(code: string, button: HTMLElement | null): void {
  if (sending) return;
  const access = accessToken();
  if (!access) { window.location.href = LOGIN_URL; return; }

  const plan = String(code || '');
  if (!plan) return;

  sending = true;
  clearMessages();
  say(hintEl, t(LANG, 'checkoutSending'));
  busy(button, true);

  const body: Record<string, unknown> = { plan, lang: LANG };
  if (autoRenewOffered && autoRenewInput?.checked) body.autoRenew = true;

  post(endpoints.subscribe, body, access).then((res) => {
    const status = res ? res.status : 0;
    const paymentUrl = res && res.ok ? res.data.paymentUrl : undefined;
    if (res && res.ok && isHttpsUrl(paymentUrl)) {
      /* Stay busy: the page is about to be replaced by the payment form. */
      say(hintEl, t(LANG, 'checkoutRedirecting'));
      window.location.href = paymentUrl;
      return;
    }
    sending = false;
    busy(button, false);
    if (res && res.ok) {
      setError(t(LANG, 'checkoutBadPaymentUrl'));
      say(hintEl, t(LANG, 'checkoutRetry'));
    } else {
      setError(failureText(res, status));
      if (status === 401 || status === 403) {
        say(hintEl, t(LANG, 'checkoutExpired'));
        show(loginEl);
      } else {
        say(hintEl, t(LANG, 'checkoutRetry'));
      }
    }
  }).catch(() => {
    sending = false;
    busy(button, false);
    setError(t(LANG, 'checkoutNetwork'));
    say(hintEl, t(LANG, 'checkoutRetry'));
  });
}

function onSelect(plan: Plan): void {
  const code = plan && plan.code ? plan.code : String(plan);
  /* The card that was pressed, so its own button shows the busy state. */
  const button = plansEl ? plansEl.querySelector<HTMLElement>('.plan__cta[data-plan="' + window.CSS.escape(code) + '"]') : null;
  subscribe(code, button);
}

/* 1 — the two billing cards and the shared list, rendered by the shared layer
   against [data-plans]. Each card's own CTA is the purchase action, so the
   page needs no separate confirm step. */
function renderPlansBlock(): Promise<void> | null {
  if (!plansEl) return null;
  try {
    const p = renderPlans(plansEl, { lang: LANG, mode: 'buy', onSelect });
    p.catch(() => { say(hintEl, t(LANG, 'checkoutNoRenderer')); });
    return p;
  } catch {
    say(hintEl, t(LANG, 'checkoutNoRenderer'));
    return null;
  }
}

/* 2 — "?plan=<code>", the deep link a card produces. renderPlans itself marks
   the matching card as selected; this only requires a session and tells the
   buyer which card they followed. Nothing is posted on load. */
function handleDeepLink(ready: Promise<void> | null): void {
  let wanted = '';
  try {
    const raw = /[?&]plan=([^&#]*)/.exec(window.location.search)?.[1];
    if (raw !== undefined) wanted = decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch { wanted = ''; }
  if (!wanted) return;

  if (!accessToken()) { window.location.href = LOGIN_URL; return; }

  const chain = ready && typeof ready.then === 'function' ? ready : Promise.resolve();
  chain.then(() => loadPlans().then((list) => {
    const plan = (list || []).find((p) => p && String(p.code) === String(wanted));
    if (plan) say(hintEl, fill(t(LANG, 'checkoutDeepLink'), plan.name || wanted));
  })).catch((error: unknown) => {
    console.error('Drafta: the deep-linked plan could not be loaded', error);
    say(hintEl, t(LANG, 'checkoutNoRenderer'));
  });
}

/* 3 — the quota line, rendered from the plan object: never a literal. */
function renderQuotaLine(): void {
  const el = document.getElementById('quota-line');
  if (!el) return;
  loadPlans().then((list) => {
    const plan = (list || []).find((p) => p && (p.billing === 'monthly' || p.billing === 'yearly'));
    if (!plan) return;
    el.textContent = fill(t(LANG, 'checkoutQuota'), formatStorage(plan.quotaBytes, LANG) + ' · ' + formatNotes(plan.quotaNotes, LANG));
    el.classList.remove('is-hidden');
  }).catch(() => { /* the shared list already carries both lines */ });
}

/* 4 — the auto-renewal consent: shown, unchecked, only while the server says it
   is available; any failure leaves the page as it was. */
function initAutoRenew(): void {
  if (!autoRenewEl || !autoRenewInput) return;
  autoRenewInput.checked = false;
  loadAutoRenewAvailable().then((available) => {
    if (!available) return;
    autoRenewOffered = true;
    show(autoRenewEl);
  }).catch(() => { /* stays hidden; the purchase works without it */ });
}

const rendered = renderPlansBlock();
initSession();
handleDeepLink(rendered);
renderQuotaLine();
initAutoRenew();
