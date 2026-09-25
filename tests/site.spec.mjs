// Static checks over the built site in dist/ — the port of
// Drafta/.landing-build/check-site.mjs to vitest + cheerio (PLAN v2 §5,
// "Задачи для tester"). Run after `npm run build`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  DIST, ORIGIN, PAGES, ROOT, allCss, allHtmlPages, fileForRoute, isNoindex, loadRoute, loadXml, readDist, requireDist,
} from './helpers/dist.mjs';

const enOf = (p) => ORIGIN + (p.lang === 'en' ? p.route : p.twin);
const ruOf = (p) => ORIGIN + (p.lang === 'ru' ? p.route : p.twin);
const prefixOf = (p) => (p.lang === 'ru' ? '/ru' : '');
const SPARKLE_NS = 'http://www.andymatuschak.org/xml-namespaces/sparkle';

describe('ЗАДАЧА-1.0 Base layout on every page', () => {
  it('[+] lang, paper theme, one canonical, the hreflang triple, one <h1>, a working skip-link; sumi theme is shipped', () => {
    const bad = [];
    for (const p of PAGES) {
      const $ = loadRoute(p.route);
      const where = p.route;
      if (!String($('html').attr('lang') || '').toLowerCase().startsWith(p.lang)) bad.push(`${where}: lang="${$('html').attr('lang')}"`);
      if ($('html').attr('data-theme') !== 'paper') bad.push(`${where}: <html data-theme="${$('html').attr('data-theme')}"> expected "paper"`);
      const canonical = $('link[rel="canonical"]').toArray().map((l) => $(l).attr('href'));
      if (canonical.length !== 1 || canonical[0] !== ORIGIN + p.route) bad.push(`${where}: canonical ${JSON.stringify(canonical)}`);
      const alt = Object.fromEntries($('link[rel="alternate"][hreflang]').toArray().map((l) => [$(l).attr('hreflang').toLowerCase(), $(l).attr('href')]));
      for (const [code, want] of [['en', enOf(p)], ['ru', ruOf(p)], ['x-default', enOf(p)]]) {
        if (alt[code] !== want) bad.push(`${where}: hreflang="${code}" is ${alt[code]}, expected ${want}`);
      }
      if ($('h1').length !== 1) bad.push(`${where}: ${$('h1').length} <h1>`);
      const skip = $('a.skip-link[href^="#"]').first();
      if (!skip.length) bad.push(`${where}: no a.skip-link`);
      else if (!$(`[id="${skip.attr('href').slice(1)}"]`).length) bad.push(`${where}: skip-link target ${skip.attr('href')} does not exist`);
    }
    expect(bad).toEqual([]);
    expect(allCss(), 'no CSS in dist/ defines the sumi theme').toMatch(/\[data-theme=["']?sumi["']?\]/);
  });

  it('[+] fonts are preloaded per language: woff2, crossorigin, the file exists, no subset of the other script', () => {
    const bad = [];
    for (const p of PAGES) {
      const $ = loadRoute(p.route);
      const links = $('link[rel="preload"][as="font"]').toArray().map((l) => $(l));
      if (!links.length) bad.push(`${p.route}: no font preload`);
      for (const l of links) {
        const href = l.attr('href') || '';
        if (l.attr('type') !== 'font/woff2' || l.attr('crossorigin') === undefined) bad.push(`${p.route}: ${href} lacks type=font/woff2 or crossorigin`);
        if (!href.startsWith('/') || !existsSync(join(DIST, href))) bad.push(`${p.route}: preloaded ${href} is not in dist/`);
        if (p.lang === 'en' && /cyrillic/i.test(href)) bad.push(`${p.route}: EN page preloads ${href}`);
        if (p.lang === 'ru' && /[-_.]latin(?![-_]ext)/i.test(href)) bad.push(`${p.route}: RU page preloads ${href}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('[-] noindex is on exactly login/register/verify/checkout (both languages) and not on the two landings', () => {
    const wrong = PAGES.filter((p) => isNoindex(loadRoute(p.route)) !== p.noindex)
      .map((p) => `${p.route}: noindex ${p.noindex ? 'missing' : 'must not be set'}`);
    expect(wrong).toEqual([]);
  });

  it('[-] no internal link on a /ru/ page leads out of /ru/ (the language switcher excepted)', () => {
    const leaks = [];
    for (const p of PAGES.filter((x) => x.lang === 'ru')) {
      const $ = loadRoute(p.route);
      $('a[href]').not('[data-lang]').each((_, a) => {
        const href = $(a).attr('href');
        if (!href.startsWith('/') || href.startsWith('//')) return;
        const path = href.split(/[?#]/)[0];
        if (/\.[a-z0-9]+$/i.test(path)) return; // files (appcast, rss, images) are language-neutral
        if (!/^\/ru(\/|$)/.test(path)) leaks.push(`${p.route}: <a href="${href}">`);
      });
    }
    expect(leaks).toEqual([]);
  });
});

describe('ЗАДАЧА-1.1 landing', () => {
  it('[+] / and /ru/ carry JSON-LD that parses and offers 9.99 and 95.88 USD', () => {
    for (const route of ['/', '/ru/']) {
      const $ = loadRoute(route);
      const blocks = $('script[type="application/ld+json"]').toArray().map((s) => $(s).text());
      expect(blocks.length, `${route}: no JSON-LD`).toBeGreaterThan(0);
      const prices = new Set();
      const currencies = new Set();
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== 'object') return;
        if ('price' in node) prices.add(String(Number(node.price)));
        if ('priceCurrency' in node) currencies.add(node.priceCurrency);
        Object.values(node).forEach(walk);
      };
      for (const text of blocks) {
        let data;
        expect(() => { data = JSON.parse(text); }, `${route}: JSON-LD is not valid JSON`).not.toThrow();
        walk(data);
      }
      expect([...prices].sort(), `${route}: offer prices`).toEqual(expect.arrayContaining(['9.99', '95.88']));
      expect([...currencies], `${route}: currency`).toEqual(['USD']);
    }
  });
});

describe('ЗАДАЧА-1.4 legal pages in the footer', () => {
  it('[wiring] every page\'s footer links Terms, Privacy, Refund, Contact in its language to built pages, and signs "by craftzman" with the seal', () => {
    const bad = [];
    for (const p of PAGES) {
      const $ = loadRoute(p.route);
      const footer = $('footer').last();
      if (!footer.length) { bad.push(`${p.route}: no <footer>`); continue; }
      const hrefs = footer.find('a[href]').toArray().map((a) => $(a).attr('href').split(/[?#]/)[0]);
      for (const slug of ['terms', 'privacy', 'refund', 'contact']) {
        const want = `${prefixOf(p)}/${slug}/`;
        if (!hrefs.includes(want)) bad.push(`${p.route}: footer has no link to ${want}`);
        else if (!existsSync(fileForRoute(want))) bad.push(`${p.route}: ${want} is linked but not built`);
      }
      if (!/by\s+craftzman/i.test(footer.text())) bad.push(`${p.route}: footer lacks "by craftzman"`);
      if (!footer.find('img[src*="seal"], svg').length) bad.push(`${p.route}: footer lacks the craftzman seal`);
    }
    expect(bad).toEqual([]);
  });

  it('[-] no two footer links share a label: two different destinations must read differently', () => {
    const bad = [];
    for (const p of PAGES) {
      const $ = loadRoute(p.route);
      const labels = $('footer').last().find('a[href]').toArray().map((a) => $(a).text().trim()).filter(Boolean);
      const repeated = labels.filter((label, i) => labels.indexOf(label) !== i);
      if (repeated.length) bad.push(`${p.route}: repeated footer labels ${JSON.stringify([...new Set(repeated)])}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('ЗАДАЧА-1.5 docs', () => {
  it('[wiring] the header of / and /ru/ links Docs to /docs/ and /ru/docs/', () => {
    expect(loadRoute('/')('header a[href="/docs/"]').length, '/ header → /docs/').toBeGreaterThan(0);
    expect(loadRoute('/ru/')('header a[href="/ru/docs/"]').length, '/ru/ header → /ru/docs/').toBeGreaterThan(0);
  });

  it('[+] /docs/, /ru/docs/ and the MCP page in both languages are built', () => {
    requireDist();
    for (const rel of ['docs/index.html', 'ru/docs/index.html', 'docs/mcp/index.html', 'ru/docs/mcp/index.html']) {
      expect(existsSync(join(DIST, rel)), `dist/${rel}`).toBe(true);
    }
    expect(loadRoute('/ru/docs/')('html').attr('lang')).toMatch(/^ru/);
  });

  it('[+] the Pagefind index covers both English and Russian', () => {
    const entry = JSON.parse(readDist('pagefind/pagefind-entry.json'));
    expect(Object.keys(entry.languages || {}).map((k) => k.slice(0, 2))).toEqual(expect.arrayContaining(['en', 'ru']));
  });
});

describe('ЗАДАЧА-1.6 routing and feeds', () => {
  it('[+] dist/404.html is built, noindex, with a language and one <h1>', () => {
    const $ = loadRoute('/404.html');
    expect(isNoindex($)).toBe(true);
    expect($('html').attr('lang')).toBeTruthy();
    expect($('h1').length).toBe(1);
  });

  it('[+] public/_redirects parses line by line, carries the three required rules and ships unchanged in dist/', () => {
    const file = join(ROOT, 'public/_redirects');
    expect(existsSync(file), 'public/_redirects').toBe(true);
    const text = readFileSync(file, 'utf8');
    const rules = [];
    const malformed = [];
    for (const [i, raw] of text.split('\n').entries()) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const [from, to, status, ...rest] = line.split(/\s+/);
      const ok = from?.startsWith('/') && /^(\/|https?:\/\/)/.test(to || '')
        && (status === undefined || /^(200|301|302|303|307|308)!?$/.test(status)) && rest.length === 0;
      if (!ok) malformed.push(`line ${i + 1}: ${raw}`);
      else rules.push(`${from} ${to} ${status ?? '302'}`);
    }
    expect(malformed).toEqual([]);
    expect(rules).toEqual(expect.arrayContaining([
      '/sitemap.xml /sitemap-index.xml 301',
      '/index.html / 301',
      '/ru/index.html /ru/ 301',
    ]));
    expect(readDist('_redirects')).toBe(text);
  });

  it('[+] robots.txt points at sitemap-index.xml, which is built', () => {
    const robots = readDist('robots.txt');
    const sitemaps = [...robots.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)].map((m) => m[1]);
    expect(sitemaps).toEqual([`${ORIGIN}/sitemap-index.xml`]);
    expect(existsSync(join(DIST, 'sitemap-index.xml'))).toBe(true);
  });

  it('[+] /appcast.xml is well-formed XML: an RSS channel with the Sparkle namespace', () => {
    const text = readDist('appcast.xml');
    const doc = new new JSDOM('').window.DOMParser().parseFromString(text, 'application/xml');
    expect(doc.getElementsByTagName('parsererror').length, 'appcast.xml is not well-formed XML').toBe(0);
    expect(doc.documentElement.nodeName).toBe('rss');
    expect(doc.documentElement.lookupNamespaceURI('sparkle')).toBe(SPARKLE_NS);
    expect(doc.getElementsByTagName('channel').length).toBe(1);
  });

  it('[-] /appcast.xml keeps the released versions: apps already in the field read this feed for updates', () => {
    const doc = new new JSDOM('').window.DOMParser().parseFromString(readDist('appcast.xml'), 'application/xml');
    const items = [...doc.getElementsByTagName('item')];
    expect(items.length, 'the shipped feed has no releases, so installed apps would never see an update').toBeGreaterThan(0);
    for (const item of items) {
      const version = item.getElementsByTagNameNS(SPARKLE_NS, 'version')[0]?.textContent?.trim();
      const enclosure = item.getElementsByTagName('enclosure')[0]?.getAttribute('url');
      expect(version, 'every release names its sparkle:version').toBeTruthy();
      expect(enclosure, `release ${version} links its download`).toMatch(/^https:\/\//);
    }
  });

  it('[-] the sitemap lists the landing but no noindex page', () => {
    const index = loadXml(readDist('sitemap-index.xml'));
    const children = index('sitemap > loc').toArray().map((n) => index(n).text().trim());
    expect(children.length, 'sitemap-index.xml lists no sitemaps').toBeGreaterThan(0);
    const locs = new Set();
    for (const url of children) {
      const rel = new URL(url).pathname.slice(1);
      const $ = loadXml(readDist(rel));
      $('url > loc').each((_, n) => locs.add($(n).text().trim()));
    }
    expect(locs.has(`${ORIGIN}/`), 'the landing is not in the sitemap').toBe(true);
    const leaked = allHtmlPages()
      .filter(({ route }) => isNoindex(loadRoute(route)))
      .map(({ route }) => ORIGIN + route)
      .filter((url) => locs.has(url) || locs.has(url.replace(/\/$/, '')));
    expect(leaked).toEqual([]);
  });
});
