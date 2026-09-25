// Content collections for drafta.org.
// `legal` holds the service pages (terms/privacy/refund/contact), one Markdown
// file per language under src/content/legal/{en,ru}/<slug>.md — the loader's id
// is "<lang>/<slug>" (e.g. "en/terms"). Wave 2 adds a `blog` collection here;
// keep this file additive (one `defineCollection` + one export entry per
// collection) rather than folding new content types into `legal`.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.string(),
  }),
});

export const collections = { legal };
