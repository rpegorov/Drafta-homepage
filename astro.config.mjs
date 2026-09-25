// drafta.org — a fully prerendered Astro site served as Workers static assets.
// No Cloudflare adapter: dist/ is uploaded as-is (see wrangler.jsonc).
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Pages that stay out of the sitemap: auth/checkout flows, the legal pages
// (noindex for now, wave 3 revisits them) and the bilingual 404, in either
// language twin. Keep in sync with the noindex pages themselves.
const SITEMAP_EXCLUDED = /^\/(ru\/)?(login|register|verify|checkout|terms|privacy|refund|contact|404)(\/|$)/;

export default defineConfig({
  site: 'https://drafta.org',
  // Every page lives at <path>/index.html and is linked with a trailing slash;
  // Workers' auto-trailing-slash redirects /login to /login/.
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    build: {
      // Scripts ship as files, never inline: the planned CSP is script-src 'self'.
      assetsInlineLimit: 0,
    },
  },
  i18n: {
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  // NOTE for the task-1.5 Starlight integration: only one @astrojs/sitemap
  // instance may run per build. If Starlight's own docs collection needs to
  // register the integration too, drop this one in favor of Starlight's and
  // fold SITEMAP_EXCLUDED into its config instead of merging two sitemaps.
  integrations: [
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDED.test(new URL(page).pathname),
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          ru: 'ru',
        },
      },
    }),
  ],
});
