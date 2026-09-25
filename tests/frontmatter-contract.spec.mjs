// ЗАДАЧА-2.0 — the one seam between the exporter and the site (PLAN v2 §11.3):
// whatever scripts/lib/frontmatter.mjs renders must pass the zod schemas of
// src/content.config.ts. Front matter is parsed the way Astro parses it.
import { describe, expect, it, vi } from 'vitest';
import { z } from 'astro/zod';
import { contractFn, importContract, parseMarkdown } from './helpers/contract.mjs';

// content.config.ts imports the virtual `astro:content`; outside the Astro build
// defineCollection is the identity, which is all the schemas need.
vi.mock('astro:content', () => ({ defineCollection: (c) => c }));

const FRONTMATTER = 'scripts/lib/frontmatter.mjs';

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
});
