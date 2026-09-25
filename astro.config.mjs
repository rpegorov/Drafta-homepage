// drafta.org — a fully prerendered Astro site served as Workers static assets.
// No Cloudflare adapter: dist/ is uploaded as-is (see wrangler.jsonc).
import { defineConfig } from 'astro/config';

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
});
