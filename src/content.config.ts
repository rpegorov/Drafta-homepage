// Content collections for drafta.org.
// `docs` and `i18n` belong to Starlight (/docs/ and /ru/docs/).
// `legal` holds the service pages (terms/privacy/refund/contact), one Markdown
// file per language under src/content/legal/{en,ru}/<slug>.md — the loader's id
// is "<lang>/<slug>" (e.g. "en/terms"). `blog` holds posts under
// src/content/blog/{en,ru}/<slug>.md, same id shape. Keep this file additive
// (one `defineCollection` + one export entry per collection) rather than
// folding new content types into an existing one.
//
// `blog`'s schema and `docs`'s schema extension mirror the front matter
// contract in scripts/lib/frontmatter.mjs (renderBlogFrontmatter /
// renderDocsFrontmatter) — the exporter (wave 2.2) writes what these schemas
// accept. Keep the two in sync when either changes.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Auto-translation metadata, written by the exporter when a post/page is a
// machine translation (wave 2.5). Kept optional here so 2.1 can render the
// "translated automatically" notice before the translator itself exists.
const translation = z.object({
  sourceHash: z.string(),
  sourceLang: z.enum(['en', 'ru']),
  provider: z.string(),
  model: z.string(),
  at: z.string(),
});

const blog = defineCollection({
  // The glob loader defaults to using frontmatter `slug` as the entry id when
  // present, which collapses "en/welcome" and "ru/welcome" onto the same id
  // ("welcome") since both share a `slug`. Force the id back to the file
  // path so it stays "<lang>/<slug>" (brain: [[Astro glob loader collapses
  // same-slug entries across languages onto one id unless generateId is set]]).
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/blog',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      lang: z.enum(['en', 'ru']),
      slug: z.string(),
      date: z.string().regex(DATE_ONLY, 'date must be YYYY-MM-DD'),
      // ISO-8601 publication instant with offset; the blog orders posts by it.
      published: z.string().optional(),
      updated: z.string().regex(DATE_ONLY, 'updated must be YYYY-MM-DD'),
      draftaId: z.string(),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      machineTranslated: z.boolean().default(false),
      translation: translation.optional(),
    }),
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.string(),
    // Editorial notes for the seller about placeholder text on the page. They
    // live in frontmatter so they never reach the published HTML.
    owner: z.array(z.string()).default([]),
    // True while the page is not ready to be indexed: it adds robots noindex
    // to the page and keeps it out of the sitemap (astro.config.mjs reads this
    // same frontmatter key).
    noindex: z.boolean().default(false),
  }),
});

export const collections = {
  blog,
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        draftaId: z.string().optional(),
        updated: z.string().optional(),
        machineTranslated: z.boolean().default(false),
        translation: translation.optional(),
      }),
    }),
  }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  legal,
};
