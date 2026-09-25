// A page in jsdom that the product's module scripts can run in, with the two
// external boundaries replaced: navigation (jsdom cannot navigate, so every
// location change is recorded instead) and the network (fetch is a stub that
// routes by API path). Nothing of the product itself is mocked.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import { ROOT } from './dist.mjs';

const GLOBAL_KEYS = [
  'window', 'document', 'location', 'navigator', 'localStorage', 'sessionStorage', 'fetch',
  'HTMLElement', 'HTMLFormElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLAnchorElement',
  'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'SubmitEvent',
  'getComputedStyle', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'DOMParser',
];

export function fixture(name) {
  return readFileSync(join(ROOT, 'tests', 'fixtures', name), 'utf8');
}

function makeLocation(startUrl, navigations) {
  const current = new URL(startUrl);
  const record = (kind, target) => navigations.push({ kind, url: new URL(String(target), current).href });
  return {
    get href() { return current.href; },
    set href(v) { record('href', v); },
    get origin() { return current.origin; },
    get protocol() { return current.protocol; },
    get host() { return current.host; },
    get hostname() { return current.hostname; },
    get port() { return current.port; },
    get pathname() { return current.pathname; },
    get search() { return current.search; },
    get hash() { return current.hash; },
    assign(v) { record('assign', v); },
    replace(v) { record('replace', v); },
    reload() {},
    toString() { return current.href; },
  };
}

/** Routes fetch by the API path: routes = { '/v1/plans': (init) => Response | Promise }. */
export function stubFetch(routes) {
  const calls = [];
  const fn = vi.fn(async (input, init = {}) => {
    const url = new URL(String(input && input.url ? input.url : input), 'https://drafta.org');
    calls.push({ path: url.pathname, url: url.href, init });
    const handler = Object.entries(routes).find(([path]) => url.pathname.endsWith(path));
    if (!handler) throw new TypeError(`unexpected fetch ${url.href}`);
    return handler[1](init);
  });
  fn.calls = calls;
  return fn;
}

export function json(status, body) {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Opens `html` at `url`, installs the page as the global environment and
 * returns handles. Call `close()` in afterEach.
 */
export async function openPage({ url, html, languages = ['en-US', 'en'], storage = {}, fetch }) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  const win = dom.window;
  if (win.document.readyState !== 'complete') {
    await new Promise((done) => win.addEventListener('load', done, { once: true }));
  }
  for (const [k, v] of Object.entries(storage)) win.localStorage.setItem(k, v);

  const navigations = [];
  const location = makeLocation(url, navigations);
  const navigator = { languages, language: languages[0], userAgent: win.navigator.userAgent, onLine: true };
  const matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
  });
  const overrides = { location, navigator, fetch, matchMedia };

  const proxy = new Proxy(win, {
    get(target, key) {
      if (key in overrides) return overrides[key];
      const value = Reflect.get(target, key);
      if (typeof value === 'function' && typeof key === 'string' && !/^[A-Z]/.test(key)) return value.bind(target);
      return value;
    },
    set(target, key, value) {
      if (key === 'location') { location.href = value; return true; }
      return Reflect.set(target, key, value);
    },
  });

  const saved = new Map();
  const install = {
    window: proxy,
    document: win.document,
    location,
    navigator,
    localStorage: win.localStorage,
    sessionStorage: win.sessionStorage,
    fetch,
    matchMedia,
    getComputedStyle: win.getComputedStyle.bind(win),
    requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
  };
  for (const key of GLOBAL_KEYS) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    const value = key in install ? install[key] : win[key];
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }

  return {
    window: win,
    document: win.document,
    navigations,
    close() {
      for (const [key, desc] of saved) {
        if (desc) Object.defineProperty(globalThis, key, desc);
        else delete globalThis[key];
      }
      win.close();
    },
  };
}

/** Imports a product script fresh (top-level code runs again), with a clear error if absent. */
export async function runScript(relPath, owner) {
  const file = join(ROOT, relPath);
  if (!existsSync(file)) {
    throw new Error(`${relPath} does not exist — ${owner} contract (PLAN — Drafta-homepage — v2, §2/§5)`);
  }
  return import(/* @vite-ignore */ file);
}

export function resetScripts() {
  vi.resetModules();
}

/** Text of the form error slot(s): `.form__error` / role=alert (DOM hooks kept 1:1 by the port). */
export function errorText(document) {
  return [...document.querySelectorAll('.form__error, [role="alert"]')]
    .map((n) => n.textContent.trim())
    .filter(Boolean)
    .join(' | ');
}
