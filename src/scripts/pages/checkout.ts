/* Drafta — checkout page script (ЗАДАЧА-1.3). Ported from /checkout/ and
   /ru/checkout/ at commit c497677: same DOM hooks, same behaviour, same
   division of ownership — `renderPlans` owns everything inside [data-plans],
   this script owns #order-form and everything in it. The page never holds a
   price of its own: it prints whatever the server returns. */

import { renderPlans, loadPlans, formatStorage, formatNotes } from '../plans';
import { post, showError, showOk } from '../forms';
import { endpoints } from '../../lib/config';
import { t } from '../../i18n';
import type { Lang, Plan } from '../../lib/types';

function pageLang(): Lang {
  const declared = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  return declared.indexOf('ru') === 0 ? 'ru' : 'en';
}

const LANG: Lang = pageLang();

/* The login page returns here with the query intact, so a ?plan= the app or a
   pricing card opened with survives the sign-in. */
const LOGIN_URL = (LANG === 'ru' ? '/ru/login/' : '/login/')
  + '?next=' + encodeURIComponent(location.pathname + location.search);
/* The access token is written only by /login/, so a sessionless buyer goes
   there. /register/ would answer 409 for a returning customer. */

function fill(template: string, value: string): string {
  return String(template).split('{value}').join(value);
}

const plansEl = document.querySelector<HTMLElement>('[data-plans]');
const formEl = document.getElementById('order-form');
const hintEl = document.getElementById('order-hint');
const fieldsEl = document.getElementById('order-fields');
const noteEl = document.getElementById('order-note');
const loginEl = document.getElementById('order-login');
if (loginEl) loginEl.setAttribute('href', LOGIN_URL);

function show(el: HTMLElement | null): void { if (el) { el.hidden = false; el.classList.remove('is-hidden'); } }
function hide(el: HTMLElement | null): void { if (el) { el.hidden = true; el.classList.add('is-hidden'); } }
function say(el: HTMLElement | null, text: string): void { if (el) el.textContent = text; }

function setError(text: string): void { showError(formEl, text); }
function setOk(text: string): void { showOk(formEl, text); }
function clearMessages(): void { showError(formEl, ''); showOk(formEl, ''); }

function read(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function token(): string { return read('drafta_access'); }

/* The card's own CTA is the purchase action, so the busy state lives on the
   button that was pressed rather than on a form-wide submit button. */
function busy(button: HTMLElement | null, on: boolean): void {
  if (!button) return;
  (button as HTMLButtonElement).disabled = !!on;
  button.classList.toggle('is-busy', !!on);
  button.setAttribute('aria-busy', on ? 'true' : 'false');
}

/* The server's response, printed field by field, verbatim. */
function renderFields(data: Record<string, unknown> | null | undefined): void {
  if (!fieldsEl) return;
  const src = data || {};
  const rows: [string, unknown][] = [
    ['plan', src.plan],
    ['status', src.status],
    ['currentPeriodEnd', src.currentPeriodEnd],
  ];
  fieldsEl.textContent = '';
  for (const [key, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = value === undefined || value === null || value === '' ? '—' : String(value);
    fieldsEl.appendChild(dt);
    fieldsEl.appendChild(dd);
  }
}

function resetResult(): void {
  clearMessages();
  hide(fieldsEl);
  hide(noteEl);
}

function initSession(): void {
  if (token()) {
    const email = read('drafta_email');
    say(hintEl, email ? fill(t(LANG, 'checkoutSignedInAs'), email) : t(LANG, 'checkoutSignedIn'));
    hide(loginEl);
  } else {
    say(hintEl, t(LANG, 'checkoutNeedsAccount'));
    show(loginEl);
  }
}

let sending = false;

/* Choosing a plan needs a session; without one the buyer goes to /login/. */
function subscribe(code: string, name: string, button: HTMLElement | null): void {
  if (sending) return;
  const access = token();
  if (!access) { window.location.href = LOGIN_URL; return; }

  const plan = String(code || '');
  if (!plan) return;

  sending = true;
  resetResult();
  say(hintEl, t(LANG, 'checkoutSending'));
  busy(button, true);

  post(endpoints.subscribe, { plan }, access).then((res) => {
    sending = false;
    busy(button, false);
    const status = res ? res.status : 0;
    if (res && res.ok) {
      /* Never claim a completed purchase: show what the server said, nothing more. */
      setOk(t(LANG, 'checkoutAccepted'));
      renderFields(res.data);
      show(fieldsEl);
      show(noteEl);
      say(hintEl, t(LANG, 'checkoutSelected') + ' ' + (name || plan));
      hide(loginEl);
    } else {
      /* The server's own error text, verbatim. */
      const message = res && res.data && res.data.error
        ? String(res.data.error)
        : t(LANG, 'checkoutNetwork') + ' (HTTP ' + status + ')';
      setError(message);
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
  const name = plan && plan.name ? plan.name : String(code || '');
  /* The card that was pressed, so its own button shows the busy state. */
  const button = plansEl ? plansEl.querySelector<HTMLElement>('.plan__cta[data-plan="' + window.CSS.escape(code) + '"]') : null;
  subscribe(code, name, button);
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

  if (!token()) { window.location.href = LOGIN_URL; return; }

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

const rendered = renderPlansBlock();
initSession();
handleDeepLink(rendered);
renderQuotaLine();
