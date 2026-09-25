// drafta.org — a fully prerendered Astro site served as Workers static assets.
// No Cloudflare adapter: dist/ is uploaded as-is (see wrangler.jsonc).
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';
import { visit } from 'unist-util-visit';
import { remarkCallouts } from './src/lib/remark-callouts.mjs';

// Flags a page as containing a ```mermaid fence so its render route can load
// the Mermaid.astro island only there — pages without one ship zero mermaid
// bytes. Astro exposes the result as `remarkPluginFrontmatter.hasMermaid`
// from `render(entry)` (see src/pages/blog/[slug].astro).
function remarkFlagMermaid() {
  return function transformer(tree, file) {
    let found = false;
    visit(tree, 'code', (node) => {
      if (node.lang === 'mermaid') found = true;
    });
    file.data.astro.frontmatter.hasMermaid = found;
  };
}

// Pages that stay out of the sitemap: auth/checkout flows and the bilingual
// 404, in either language twin. Keep in sync with the noindex pages themselves.
const SITEMAP_EXCLUDED = /^\/(ru\/)?(login|register|verify|checkout|404)(\/|$)/;

const LEGAL_DIR = new URL('./src/content/legal/', import.meta.url);
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const NOINDEX_KEY = /^noindex:\s*true\s*$/m;

function isNoindexEntry(file) {
  const frontmatter = FRONTMATTER.exec(readFileSync(new URL(file, LEGAL_DIR), 'utf8'))?.[1] ?? '';
  return NOINDEX_KEY.test(frontmatter);
}

// "ru/terms.md" -> "/ru/terms/", "en/terms.md" -> "/terms/"
function legalPath(file) {
  const [lang, name] = file.replace(/\.md$/, '').split('/');
  return lang === 'ru' ? `/ru/${name}/` : `/${name}/`;
}

// Legal pages whose frontmatter says `noindex: true` — the same key
// LegalPage.astro turns into robots noindex, so the two cannot disagree.
const LEGAL_NOINDEX = new Set(
  readdirSync(LEGAL_DIR, { recursive: true })
    .map((file) => String(file).replaceAll('\\', '/'))
    .filter((file) => file.endsWith('.md') && isNoindexEntry(file))
    .map(legalPath),
);

function inSitemap(pathname) {
  return !SITEMAP_EXCLUDED.test(pathname) && !LEGAL_NOINDEX.has(pathname);
}

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
  markdown: {
    // Switches from Astro 7's default Sätteri processor to unified/remark so
    // our own remark plugins can run. Applies to both the blog collection and
    // Starlight's docs — they share this one Astro markdown pipeline.
    processor: unified({
      remarkPlugins: [remarkCallouts, remarkFlagMermaid],
    }),
  },
  integrations: [
    // One sitemap for the whole site, docs included. Starlight only registers its
    // own @astrojs/sitemap when none is configured, so this instance (with the
    // noindex filter) is the only one in the build.
    sitemap({
      filter: (page) => inSitemap(new URL(page).pathname),
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', ru: 'ru' },
      },
    }),
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
      customCss: [
        './src/styles/tokens.css',
        './src/styles/product.css',
        './src/styles/starlight.css',
        './src/styles/callouts.css',
      ],
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
