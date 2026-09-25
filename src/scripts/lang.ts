/* Drafta — language handling. Loads on every page (Base.astro).
   It never rewrites page text: translation is by file, and the switcher is a
   plain link that works without JavaScript. This module only (1) remembers an
   explicit choice and (2) sends a Russian browser from an English page to its
   /ru/ twin, keeping the query string and hash. */

import { isRuPath, ruSearch, twinPath } from '../lib/lang';

const KEY = 'drafta_lang';

function store(value: string): void {
  try { localStorage.setItem(KEY, value); } catch { /* private mode: the choice is simply not remembered */ }
}

function stored(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/* The path decides first, which keeps the redirect idempotent even if a
   Russian page forgot its lang attribute; the declared lang covers the rest. */
export function isRuPage(doc: Document = document, loc: Location = location): boolean {
  if (isRuPath(loc.pathname)) return true;
  const declared = (doc.documentElement.getAttribute('lang') || '').toLowerCase();
  return declared.indexOf('ru') === 0;
}

export function preferredLanguage(nav: Navigator = navigator): string {
  const list = nav.languages && nav.languages.length ? nav.languages : [nav.language || ''];
  return String(list[0] || '').toLowerCase();
}

function rememberChoice(event: Event): void {
  const node = event.target as Element | null;
  if (!node || typeof node.closest !== 'function') return;
  const link = node.closest('a[data-lang]');
  if (!link) return;
  const value = link.getAttribute('data-lang');
  if (value) store(value);
}

export function initLang(): void {
  document.addEventListener('click', rememberChoice);

  const ru = isRuPage();
  if (!ru && !stored() && preferredLanguage().indexOf('ru') === 0) {
    location.replace(twinPath(location.pathname, ru) + ruSearch(location.search) + location.hash);
  }
}

initLang();
