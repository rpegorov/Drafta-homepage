/* Drafta — pricing. Imported by page scripts; does nothing until renderPlans runs.

   ONE PLAN, TWO BILLING CARDS, ONE SHARED LIST. The product is a single plan
   with a monthly and a yearly billing option — two cards ARE the choice, so
   there is no period switch and no badge. Only entries whose `billing` is
   "monthly" or "yearly" are rendered; a "one_time" tier or any future tier is
   filtered out and never reaches the DOM.

   Inside the container it renders, in order: the two sibling `.plan` cards (the
   yearly one first and featured), then ONE `.plan__list` below both cards, and
   finally a muted trial sentence. Storage and notes are read from the plan
   object, never from a literal. */

import { DRAFTA } from '../lib/config';
import { esc } from '../lib/esc';
import type { Lang, Plan } from '../lib/types';
import { normalizeLang, t } from '../i18n';

export type PlansMode = 'link' | 'buy';

export interface RenderPlansOptions {
  lang?: Lang | string;
  mode?: PlansMode | string;
  /** Buy mode only: called with the plan whose button was pressed. */
  onSelect?: (plan: Plan) => void;
}

const PERIODS = ['monthly', 'yearly'];
/* Card order: the yearly card first, the monthly card second. */
const ORDER = ['yearly', 'monthly'];
const GIB = 1073741824;
const CENTS_PER_DOLLAR = 100;

function fill(template: string, value: string): string {
  return String(template).split('{value}').join(String(value));
}

function group(number: number, lang: Lang): string {
  const sep = lang === 'ru' ? ' ' : ',';
  return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** 9588 -> "$95.88"; 0 or invalid -> "—". Prices are US cents in both languages. */
export function formatPrice(cents: unknown, _lang?: string): string {
  const value = Number(cents);
  if (!isFinite(value) || value <= 0) return '—';
  return '$' + (value / CENTS_PER_DOLLAR).toFixed(2);
}

/** 32212254720 -> "30 GB storage"; <= 0 or absent -> "Unlimited storage". Binary units (GiB). */
export function formatStorage(bytes: unknown, lang?: string): string {
  const value = Number(bytes);
  if (!isFinite(value) || value <= 0) return t(lang, 'unlimitedStorage');
  const rounded = Math.round((value / GIB) * 10) / 10;
  const text = Math.abs(rounded - Math.round(rounded)) < 0.05
    ? String(Math.round(rounded))
    : rounded.toFixed(1);
  return text + ' ' + t(lang, 'gb') + ' ' + t(lang, 'storage');
}

/** The grouped count plus its noun; <= 0 or absent -> "Unlimited notes". */
export function formatNotes(count: unknown, lang?: string): string {
  const value = Number(count);
  if (!isFinite(value) || value <= 0) return t(lang, 'unlimitedNotes');
  const whole = Math.round(value);
  return group(whole, normalizeLang(lang)) + ' ' + t(lang, 'note')(whole);
}

/* The link-mode target is /checkout/?plan=<code>; a Russian page links its twin. */
function checkoutHref(code: string, lang: Lang): string {
  return (lang === 'ru' ? '/ru' : '') + '/checkout/?plan=' + encodeURIComponent(code);
}

/* The code a ?plan= on the current URL refers to, so the matching card is
   marked as selected. Selection is styling only — nothing is posted. */
function requestedCode(): string {
  try {
    const search = window.location && window.location.search ? String(window.location.search) : '';
    const match = /[?&]plan=([^&#]*)/.exec(search);
    return match && match[1] !== undefined ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
  } catch {
    return '';
  }
}

/* One card. The yearly card's price line is its monthly equivalent, with the
   annual total as a muted note beneath it; the monthly card is the quiet alternative. */
function cardHtml(plan: Plan, lang: Lang, mode: PlansMode, isFeatured: boolean, selected: boolean): string {
  const equivalent = plan.billing === 'yearly' && Number(plan.monthlyCents) > 0;
  const headline = equivalent ? Number(plan.monthlyCents) : Number(plan.priceCents);
  const unit = t(lang, 'periodShort')[equivalent ? 'monthly' : plan.billing] || '';
  const priceClass = 'plan__price' + (equivalent ? ' plan__equiv' : '');
  const ctaClass = 'plan__cta btn ' + (isFeatured ? 'btn--primary plan__cta--featured' : 'btn--ghost');
  const choose = t(lang, 'choose');
  const label = choose[plan.billing] || choose['yearly'];
  const cta = mode === 'buy'
    ? '<button type="button" class="' + ctaClass + '" data-plan="' + esc(plan.code) + '">' + esc(label) + '</button>'
    : '<a class="' + ctaClass + '" href="' + esc(checkoutHref(String(plan.code || ''), lang)) + '">' + esc(label) + '</a>';

  return '<article class="plan' + (isFeatured ? ' plan--featured' : '')
    + (selected ? ' plan--selected' : '') + '" data-period="' + esc(plan.billing) + '">'
    + '<h3 class="plan__name">' + esc(t(lang, 'periodLabel')[plan.billing] || '') + '</h3>'
    + '<div class="' + priceClass + '">' + esc(formatPrice(headline, lang))
    + '<span class="plan__period"> / ' + esc(unit) + '</span></div>'
    + (equivalent
      ? '<div class="plan__note">' + esc(fill(t(lang, 'billedAnnually'), formatPrice(plan.priceCents, lang))) + '</div>'
      : '')
    + cta
    + '</article>';
}

/* The shared checklist: one `.plan__list` below both cards. */
function listHtml(plan: Plan, lang: Lang): string {
  const items = [
    t(lang, 'cloudSync'),
    formatNotes(plan.quotaNotes, lang),
    formatStorage(plan.quotaBytes, lang),
    t(lang, 'noFees'),
  ];
  return '<ul class="plan__list">'
    + items.map((item) => '<li class="plan__item"><span class="plan__tick" aria-hidden="true"></span>' + esc(item) + '</li>').join('')
    + '</ul>';
}

/* Builds the two cards, the shared list and the trial line. Returns false when
   the data carries no sellable period, in which case nothing is rendered. */
function renderPricing(el: HTMLElement, plans: Plan[], lang: Lang, mode: PlansMode,
  options: RenderPlansOptions, selectedCode: string): boolean {
  const byPeriod: Record<string, Plan> = {};
  for (const plan of plans) {
    if (plan && PERIODS.indexOf(plan.billing) !== -1 && !byPeriod[plan.billing]) byPeriod[plan.billing] = plan;
  }
  const periods = ORDER.filter((key) => !!byPeriod[key]);
  const first = periods[0] !== undefined ? byPeriod[periods[0]] : undefined;
  if (!first) { el.innerHTML = ''; return false; }

  /* A ?plan= on the URL marks its card in both modes; styling only. */
  const cards = periods.map((key) => {
    const card = byPeriod[key] as Plan;
    const selected = !!selectedCode && String(card.code) === String(selectedCode);
    return cardHtml(card, lang, mode, key === 'yearly', selected);
  }).join('');

  /* The list is shared by both cards, so it is filled from the first sellable
     plan — today both periods carry the same quota. */
  el.classList.add('plans');
  el.innerHTML = cards + listHtml(first, lang) + '<p class="plan__trial">' + esc(t(lang, 'trial')) + '</p>';

  /* A container that cannot be queried (a test stub) keeps its markup; the
     buttons simply cannot be wired. */
  if (typeof el.querySelector !== 'function') return true;

  const onSelect = options.onSelect;
  if (mode === 'buy' && typeof onSelect === 'function') {
    el.querySelectorAll('.plan').forEach((card) => {
      const button = card.querySelector('.plan__cta[data-plan]');
      const owner = byPeriod[card.getAttribute('data-period') || ''];
      if (!button || !owner) return;
      button.addEventListener('click', () => { onSelect(owner); });
    });
  }
  return true;
}

function fallback(): Plan[] {
  const list = DRAFTA.planFallback;
  return Array.isArray(list) ? list.slice() : [];
}

async function fetchPlans(): Promise<Plan[]> {
  const url = String(DRAFTA.api || '') + String((DRAFTA.endpoints || {}).plans || '');
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return fallback();
    const data = (await response.json()) as { plans?: unknown } | null;
    const plans = data && data.plans;
    if (!Array.isArray(plans) || !plans.length) return fallback();
    return plans as Plan[];
  } catch {
    return fallback();
  }
}

/* One request per page load: every caller on the page shares this promise. */
let pending: Promise<Plan[]> | null = null;

/** API first, planFallback on any failure or bad shape. Returns a fresh copy of the list. */
export function loadPlans(): Promise<Plan[]> {
  if (!pending) pending = fetchPlans();
  return pending.then((plans) => plans.slice());
}

/** Fills el with the .plans markup: two billing cards, the shared list and the trial line. */
export async function renderPlans(el: HTMLElement | null | undefined, opts?: RenderPlansOptions): Promise<void> {
  if (!el || typeof el.innerHTML !== 'string') return;
  const options = opts || {};
  const lang = normalizeLang(options.lang);
  const mode: PlansMode = options.mode === 'buy' ? 'buy' : 'link';

  const plans = await loadPlans();
  const kept = (plans || []).filter((plan) => plan && PERIODS.indexOf(plan.billing) !== -1);
  renderPricing(el, kept, lang, mode, options, requestedCode());
}
