// Content collections for drafta.org.
// `docs` and `i18n` belong to Starlight (/docs/ and /ru/docs/).
// `legal` holds the service pages (terms/privacy/refund/contact), one Markdown
// file per language under src/content/legal/{en,ru}/<slug>.md — the loader's id
// is "<lang>/<slug>" (e.g. "en/terms"). Wave 2 adds a `blog` collection here;
// keep this file additive (one `defineCollection` + one export entry per
// collection) rather than folding new content types into `legal`.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.string(),
    // Editorial notes for the seller about placeholder text on the page. They
    // live in frontmatter so they never reach the published HTML.
    owner: z.array(z.string()).default([]),
  }),
});

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
  legal,
};
