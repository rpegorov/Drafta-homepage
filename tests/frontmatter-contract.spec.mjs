// ЗАДАЧА-2.0 — the one seam between the exporter and the site (PLAN v2 §11.3):
// whatever scripts/lib/frontmatter.mjs renders must pass the zod schemas of
// src/content.config.ts, callouts become <aside>, and the mermaid bundle stays
// off pages that have no diagram.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'astro/zod';
import { unified } from 'unified';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';
import * as cheerio from 'cheerio';
import { contractFn, importContract, parseMarkdown } from './helpers/contract.mjs';
import { DIST, ROOT, allHtmlPages, loadRoute } from './helpers/dist.mjs';

// content.config.ts imports the virtual `astro:content`; outside the Astro build
// defineCollection is the identity, which is all the schemas need.
vi.mock('astro:content', () => ({ defineCollection: (c) => c }));

const FRONTMATTER = 'scripts/lib/frontmatter.mjs';
const CALLOUTS = 'src/lib/remark-callouts.mjs';

const BLOG_INPUT = {
  title: 'Hello world',
  description: 'The first post written in Drafta',
  lang: 'en',
  slug: 'hello-world',
  date: '2026-09-21',
  updated: '2026-09-22',
  draftaId: '0A000000-0000-4000-8000-00000000000A',
  tags: ['drafta'],
};

const DOCS_INPUT = {
  title: 'MCP server',
  description: 'What the built-in MCP server can do',
  lang: 'en',
  slug: 'mcp-server',
  updated: '2026-09-22',
  draftaId: '08000000-0000-4000-8000-000000000008',
  order: 40,
};

async function collections() {
  const mod = await importContract('src/content.config.ts', '2.0');
  return mod.collections;
}

/** A collection's zod schema; Astro passes `image()` to function schemas. */
function schemaOf(collection) {
  const { schema } = collection;
  return typeof schema === 'function' ? schema({ image: () => z.string() }) : schema;
}

async function blogSchema() {
  const { blog } = await collections();
  if (!blog) throw new Error('src/content.config.ts: нет коллекции `blog` — контракт ЗАДАЧИ-2.0');
  return schemaOf(blog);
}

async function renderedBlogData(overrides = {}) {
  const mod = await importContract(FRONTMATTER, '2.0');
  const render = contractFn(mod, ['renderBlogFrontmatter'], FRONTMATTER, '2.0');
  return parseMarkdown(render({ ...BLOG_INPUT, ...overrides })).data;
}

/** Relative JS files a page loads, followed through static and dynamic imports. */
function scriptsReachedFrom(html) {
  const $ = cheerio.load(html);
  const queue = [
    ...$('script[src]').toArray().map((el) => $(el).attr('src')),
    ...$('link[rel="modulepreload"][href]').toArray().map((el) => $(el).attr('href')),
  ]
    .filter((src) => src.startsWith('/'))
    .map((src) => join(DIST, src.split(/[?#]/)[0]));
  const seen = new Set();
  const bodies = [$('script:not([src])').text()];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const js = readFileSync(file, 'utf8');
    bodies.push(file, js);
    for (const m of js.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
      queue.push(resolve(dirname(file), m[1]));
    }
  }
  return bodies.join('\n');
}

async function markdownToHtml(md) {
  const mod = await importContract(CALLOUTS, '2.0');
  const plugin = contractFn(mod, ['default', 'remarkCallouts'], CALLOUTS, '2.0');
  const tree = await unified().use(plugin).run(fromMarkdown(md));
  return toHtml(toHast(tree));
}

describe('ЗАДАЧА-2.0 front matter contract', () => {
  it('[wiring] content.config.ts has a blog collection that accepts renderBlogFrontmatter output', async () => {
    const schema = await blogSchema();
    const result = schema.safeParse(await renderedBlogData());
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.data).toMatchObject({ lang: 'en', slug: 'hello-world', draftaId: BLOG_INPUT.draftaId });
    // §11.9: machineTranslated is part of the contract and defaults to false.
    expect(result.data.machineTranslated).toBe(false);
  });

  it('the docs collection accepts renderDocsFrontmatter output and keeps sidebar order and draftaId', async () => {
    const { docs } = await collections();
    const mod = await importContract(FRONTMATTER, '2.0');
    const render = contractFn(mod, ['renderDocsFrontmatter'], FRONTMATTER, '2.0');
    const result = schemaOf(docs).safeParse(parseMarkdown(render(DOCS_INPUT)).data);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.data.sidebar?.order).toBe(40);
    expect(result.data.draftaId).toBe(DOCS_INPUT.draftaId);
  });

  it('a > [!NOTE] callout reaches dist/ as <aside class="callout callout--note">', () => {
    const pages = allHtmlPages().filter(({ file }) => readFileSync(file, 'utf8').includes('callout--note'));
    const asides = pages.flatMap(({ route }) => loadRoute(route)('aside.callout.callout--note').toArray());
    expect(asides.length, 'no page in dist/ renders a NOTE callout as <aside>').toBeGreaterThan(0);
  });

  it('the mermaid bundle loads on the page with a diagram and not on dist/index.html', () => {
    const withDiagram = allHtmlPages().filter(({ file }) => /class="[^"]*\bmermaid\b|language-mermaid/.test(readFileSync(file, 'utf8')));
    expect(withDiagram.length, 'no page in dist/ has a mermaid block (fixture of ЗАДАЧИ-2.0)').toBeGreaterThan(0);
    const diagramScripts = scriptsReachedFrom(readFileSync(withDiagram[0].file, 'utf8'));
    expect(diagramScripts, `${withDiagram[0].route} does not load mermaid`).toMatch(/mermaid/i);
    expect(scriptsReachedFrom(readFileSync(join(ROOT, 'dist/index.html'), 'utf8'))).not.toMatch(/mermaid/i);
  });
});

describe('ЗАДАЧА-2.0 front matter contract — rejections', () => {
  it('blog front matter without draftaId does not pass the schema', async () => {
    const schema = await blogSchema();
    const { draftaId, ...withoutId } = await renderedBlogData();
    expect(draftaId).toBe(BLOG_INPUT.draftaId);
    expect(schema.safeParse(withoutId).success).toBe(false);
  });

  it("lang 'de' is rejected", async () => {
    const schema = await blogSchema();
    const data = await renderedBlogData();
    expect(schema.safeParse({ ...data, lang: 'de' }).success).toBe(false);
  });

  it('a date that is not YYYY-MM-DD is rejected', async () => {
    const schema = await blogSchema();
    const data = await renderedBlogData();
    for (const date of ['2026-9-5', '25.09.2026', '2026-09-21T10:00:00Z']) {
      expect(schema.safeParse({ ...data, date }).success, date).toBe(false);
    }
  });

  it('[!UNKNOWN] stays a plain blockquote while [!NOTE] becomes an aside', async () => {
    const note = await markdownToHtml('> [!NOTE]\n> Notes are plain files.\n');
    expect(note, 'remark-callouts does not turn [!NOTE] into an aside').toMatch(/<aside[^>]*class="[^"]*callout--note/);
    const unknown = await markdownToHtml('> [!UNKNOWN]\n> Not a callout type.\n');
    expect(unknown).toMatch(/<blockquote/);
    expect(unknown).not.toMatch(/<aside/);
  });
});
