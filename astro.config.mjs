// drafta.org — a fully prerendered Astro site served as Workers static assets.
// No Cloudflare adapter: dist/ is uploaded as-is (see wrangler.jsonc).
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
  integrations: [
    // Docs at /docs/ and /ru/docs/. Starlight has no route prefix, so the pages
    // live under src/content/docs/docs/ (EN, root locale) and src/content/docs/ru/docs/.
    starlight({
      title: { en: 'Docs', ru: 'Документация' },
      // No `locales` here: Starlight refuses them next to the site's `i18n` below
      // and derives the same pair from it — root = en (no prefix), ru = /ru/.
      // The site's own src/pages/404.astro serves both languages.
      disable404Route: true,
      favicon: '/favicon.svg',
      head: ['/fonts/GolosText.woff2', '/fonts/Lora.woff2'].map((href) => ({
        tag: 'link',
        attrs: { rel: 'preload', href, as: 'font', type: 'font/woff2', crossorigin: true },
      })),
      customCss: ['./src/styles/tokens.css', './src/styles/product.css', './src/styles/starlight.css'],
      components: {
        SiteTitle: './src/components/starlight/SiteTitle.astro',
        ThemeProvider: './src/components/starlight/ThemeProvider.astro',
        ThemeSelect: './src/components/starlight/ThemeSelect.astro',
      },
      sidebar: [
        {
          label: 'Documentation',
          translations: { ru: 'Документация' },
          items: [{ autogenerate: { directory: 'docs' } }],
        },
      ],
    }),
  ],
  i18n: {
    locales: ['en', 'ru'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
