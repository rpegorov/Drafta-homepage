// Reads the built site in dist/. Every loader fails with a message that names
// the missing piece and the task that owns it, so a red test explains itself.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const DIST = join(ROOT, 'dist');
export const ORIGIN = 'https://drafta.org';

/** The ten pages of the old site and their twins (reference: commit c497677). */
export const PAGES = [
  { route: '/', lang: 'en', twin: '/ru/', noindex: false },
  { route: '/ru/', lang: 'ru', twin: '/', noindex: false },
  { route: '/login/', lang: 'en', twin: '/ru/login/', noindex: true },
  { route: '/ru/login/', lang: 'ru', twin: '/login/', noindex: true },
  { route: '/register/', lang: 'en', twin: '/ru/register/', noindex: true },
  { route: '/ru/register/', lang: 'ru', twin: '/register/', noindex: true },
  { route: '/verify/', lang: 'en', twin: '/ru/verify/', noindex: true },
  { route: '/ru/verify/', lang: 'ru', twin: '/verify/', noindex: true },
  { route: '/checkout/', lang: 'en', twin: '/ru/checkout/', noindex: true },
  { route: '/ru/checkout/', lang: 'ru', twin: '/checkout/', noindex: true },
];

export function requireDist() {
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error(
      'dist/index.html is missing — run `npm run build` before `npm test` ' +
        '(ЗАДАЧА-1.0 contract: Astro build into dist/, build.format "directory").',
    );
  }
}

/** '/ru/login/' -> dist/ru/login/index.html */
export function fileForRoute(route) {
  const clean = route.split(/[?#]/)[0];
  if (clean.endsWith('/')) return join(DIST, ...clean.split('/').filter(Boolean), 'index.html');
  return join(DIST, ...clean.split('/').filter(Boolean));
}

export function readDist(rel) {
  requireDist();
  const file = join(DIST, rel);
  if (!existsSync(file)) throw new Error(`dist/${rel} is missing`);
  return readFileSync(file, 'utf8');
}

export function loadRoute(route) {
  requireDist();
  const file = fileForRoute(route);
  if (!existsSync(file)) throw new Error(`${route}: expected built page at ${file.slice(ROOT.length + 1)}`);
  return cheerio.load(readFileSync(file, 'utf8'));
}

export function loadXml(text) {
  return cheerio.load(text, { xml: true });
}

export function isNoindex($) {
  return $('meta[name="robots"]')
    .toArray()
    .some((m) => /\bnoindex\b/i.test($(m).attr('content') || ''));
}

/** Every *.html under dist/ as { route, file }. */
export function allHtmlPages() {
  requireDist();
  return readdirSync(DIST, { recursive: true })
    .map(String)
    .filter((rel) => rel.endsWith('.html'))
    .map((rel) => {
      const parts = rel.split(sep);
      const route = parts.at(-1) === 'index.html'
        ? '/' + parts.slice(0, -1).map((p) => p + '/').join('')
        : '/' + parts.join('/');
      return { route, file: join(DIST, rel) };
    });
}

export function allCss() {
  requireDist();
  return readdirSync(DIST, { recursive: true })
    .map(String)
    .filter((rel) => rel.endsWith('.css'))
    .map((rel) => readFileSync(join(DIST, rel), 'utf8'))
    .join('\n');
}
