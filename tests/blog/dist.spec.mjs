// ЗАДАЧА-2.1 — the blog as built into dist/ (PLAN v2 §11.4, §11.5, §11.9 п. 7).
// Posts are enumerated from src/content/blog/{en,ru}/*.md, so the checks hold
// for the fixtures of 2.0 and for real exported posts alike.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { readMarkdown } from '../helpers/contract.mjs';
import { DIST, ORIGIN, ROOT, loadRoute, readDist } from '../helpers/dist.mjs';

const BLOG_SRC = join(ROOT, 'src/content/blog');
const LANGS = ['en', 'ru'];
const blogRoot = (lang) => (lang === 'ru' ? '/ru/blog/' : '/blog/');
const rssPath = (lang) => (lang === 'ru' ? 'ru/rss.xml' : 'rss.xml');
const BANNER = { en: /Translated automatically/i, ru: /Переведено автоматически/i };

/** Every post source as { lang, slug, route, machineTranslated, cover }. */
function posts() {
  if (!existsSync(BLOG_SRC)) throw new Error('src/content/blog не существует — контракт ЗАДАЧИ-2.0');
  return LANGS.flatMap((lang) => {
    const dir = join(BLOG_SRC, lang);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const { data } = readMarkdown(join(dir, f));
        const slug = data.slug ?? f.replace(/\.md$/, '');
        return { lang, slug, route: `${blogRoot(lang)}${slug}/`, machineTranslated: data.machineTranslated === true, cover: data.cover };
      });
  });
}

function requirePosts(lang) {
  const list = posts().filter((p) => !lang || p.lang === lang);
  expect(list.length, `no ${lang ?? ''} posts in src/content/blog`).toBeGreaterThan(0);
  return list;
}

const twinOf = (post) => posts().find((p) => p.slug === post.slug && p.lang !== post.lang);

function pngSize(file) {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8).toString('hex'), `${file} is not a PNG`).toBe('89504e470d0a1a0a');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function rssDocument(lang) {
  const { DOMParser } = new JSDOM('').window;
  const doc = new DOMParser().parseFromString(readDist(rssPath(lang)), 'application/xml');
  expect(doc.getElementsByTagName('parsererror').length, `${rssPath(lang)} is not well-formed XML`).toBe(0);
  return doc;
}

describe('ЗАДАЧА-2.1 blog in dist/', () => {
  it('[wiring] /blog/ and /ru/blog/ list every post of their language and advertise the RSS feed', () => {
    for (const lang of LANGS) {
      const list = loadRoute(blogRoot(lang));
      const hrefs = list('a[href]').toArray().map((a) => list(a).attr('href'));
      for (const post of requirePosts(lang)) {
        expect(hrefs.some((h) => h.replace(ORIGIN, '') === post.route), `${blogRoot(lang)} does not link ${post.route}`).toBe(true);
        const page = loadRoute(post.route);
        expect(page('link[rel="alternate"][type="application/rss+xml"]').attr('href') ?? '', post.route).toMatch(new RegExp(`/${rssPath(lang)}$`));
      }
      expect(list('link[rel="alternate"][type="application/rss+xml"]').attr('href') ?? '').toMatch(new RegExp(`/${rssPath(lang)}$`));
    }
  });

  it('both RSS feeds are valid RSS 2.0 with one dated item per post of their language', () => {
    for (const lang of LANGS) {
      const doc = rssDocument(lang);
      expect(doc.documentElement.nodeName).toBe('rss');
      expect(doc.documentElement.getAttribute('version')).toBe('2.0');
      const channel = doc.getElementsByTagName('channel')[0];
      for (const tag of ['title', 'link', 'description']) {
        expect(channel.getElementsByTagName(tag)[0]?.textContent.trim(), `${rssPath(lang)} channel <${tag}>`).toBeTruthy();
      }
      const items = [...doc.getElementsByTagName('item')].map((item) => ({
        title: item.getElementsByTagName('title')[0]?.textContent.trim(),
        link: item.getElementsByTagName('link')[0]?.textContent.trim(),
        pubDate: item.getElementsByTagName('pubDate')[0]?.textContent.trim(),
      }));
      const expected = requirePosts(lang).map((p) => `${ORIGIN}${p.route}`).sort();
      expect(items.map((i) => i.link).sort()).toEqual(expected);
      for (const item of items) {
        expect(item.title, item.link).toBeTruthy();
        expect(Number.isNaN(Date.parse(item.pubDate)), `${item.link} pubDate "${item.pubDate}"`).toBe(false);
      }
    }
  });

  it('every post has og:image /og/<lang>/<slug>.png that exists in dist/ at 1200×630', () => {
    for (const post of requirePosts()) {
      const og = loadRoute(post.route)('meta[property="og:image"]').attr('content') ?? '';
      const path = `/og/${post.lang}/${post.slug}.png`;
      expect(og.replace(ORIGIN, ''), post.route).toBe(path);
      const file = join(DIST, path);
      expect(existsSync(file), `dist${path} is missing`).toBe(true);
      expect(pngSize(file), path).toEqual({ width: 1200, height: 630 });
    }
  });

  it('a machine-translated post shows the "translated automatically" notice', () => {
    const auto = requirePosts().filter((p) => p.machineTranslated);
    expect(auto.length, 'no post has machineTranslated: true (fixture ru/welcome.md, PLAN §11.9)').toBeGreaterThan(0);
    for (const post of auto) {
      expect(loadRoute(post.route)('body').text(), post.route).toMatch(BANNER[post.lang]);
    }
  });
});

describe('ЗАДАЧА-2.1 blog in dist/ — what must not be there', () => {
  it('hreflang links appear only on posts that have a twin, and point at that twin', () => {
    for (const post of requirePosts()) {
      const $ = loadRoute(post.route);
      const alternates = $('link[rel="alternate"][hreflang]').toArray().map((l) => ({
        lang: $(l).attr('hreflang'),
        href: ($(l).attr('href') ?? '').replace(ORIGIN, ''),
      }));
      const twin = twinOf(post);
      if (!twin) {
        expect(alternates, `${post.route} has no twin but carries hreflang`).toEqual([]);
        continue;
      }
      expect(alternates.find((a) => a.lang === twin.lang)?.href, post.route).toBe(twin.route);
      expect(alternates.find((a) => a.lang === post.lang)?.href, post.route).toBe(post.route);
    }
  });

  it('/blog/ and the English feed carry no Russian post', () => {
    const $ = loadRoute('/blog/');
    const links = $('a[href]').toArray().map((a) => ($(a).attr('href') ?? '').replace(ORIGIN, ''));
    expect(links.filter((h) => h.startsWith('/ru/blog/'))).toEqual([]);
    for (const route of links.filter((h) => /^\/blog\/[^/]+\/$/.test(h))) {
      expect(loadRoute(route)('html').attr('lang'), route).toBe('en');
    }
    expect(readDist('rss.xml')).not.toMatch(/drafta\.org\/ru\/blog\//);
  });

  it('a hand-written post shows no "translated automatically" notice', () => {
    for (const post of requirePosts().filter((p) => !p.machineTranslated)) {
      expect(loadRoute(post.route)('body').text(), post.route).not.toMatch(BANNER[post.lang]);
    }
  });

  it('a post without cover still builds with its generated OG image', () => {
    const coverless = requirePosts().filter((p) => !p.cover);
    expect(coverless.length, 'every post has a cover — nothing proves the coverless path').toBeGreaterThan(0);
    for (const post of coverless) {
      expect(existsSync(join(DIST, `og/${post.lang}/${post.slug}.png`)), post.route).toBe(true);
      expect(loadRoute(post.route)('h1').text().trim(), post.route).not.toBe('');
    }
  });
});
