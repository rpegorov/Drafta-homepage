// Legal pages: whether a page is indexable is decided once, by `noindex` in its
// frontmatter; the seller's editorial notes never reach the published HTML.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, allHtmlPages, isNoindex, loadRoute } from './helpers/dist.mjs';

const SLUGS = ['terms', 'privacy', 'refund', 'contact'];
const LANGS = ['en', 'ru'];

function frontmatterNoindex(lang, slug) {
  const text = readFileSync(join(ROOT, 'src/content/legal', lang, `${slug}.md`), 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  return /^noindex:\s*true\s*$/m.test(frontmatter);
}

describe('legal pages', () => {
  it('[+] every legal page flagged noindex: true in its frontmatter carries robots noindex', () => {
    const missing = [];
    for (const lang of LANGS) {
      for (const slug of SLUGS) {
        if (!frontmatterNoindex(lang, slug)) continue;
        const route = lang === 'ru' ? `/ru/${slug}/` : `/${slug}/`;
        if (!isNoindex(loadRoute(route))) missing.push(route);
      }
    }
    expect(missing, 'pages whose frontmatter says noindex but whose HTML does not').toEqual([]);
  });

  it('[-] no built page contains an <!-- OWNER comment', () => {
    const leaking = allHtmlPages()
      .filter(({ file }) => readFileSync(file, 'utf8').includes('<!-- OWNER'))
      .map(({ route }) => route);
    expect(leaking).toEqual([]);
  });
});
