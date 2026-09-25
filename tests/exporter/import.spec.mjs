// ЗАДАЧА-2.2 — the Drafta → site exporter, driven through its CLI contract
// (`--library --site [--commit] --json`, PLAN v2 §11.3) on the fixture library.
// Selection rule under test (§11.4, §11.0): completed, not trashed, not a
// template, tag drafta/blog|drafta/docs by full path (body or extraTags), site block
// with slug + description, no publish: false; sealed files are skipped.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ROOT } from '../helpers/dist.mjs';
import { EXPORTER, FIXTURE, ID, git, makeWorld, runExporter, sitePost, slugs, titles } from '../helpers/library.mjs';

const worlds = [];
function world(opts) {
  const w = makeWorld(opts);
  worlds.push(w);
  return w;
}
afterEach(() => {
  while (worlds.length) worlds.pop().cleanup();
});

const CONTRACT_KEYS = ['created', 'updated', 'deleted', 'skipped', 'errors', 'committed', 'pushed'];

describe('ЗАДАЧА-2.2 exporter', () => {
  it('[wiring] npm run import:drafta runs the CLI, whose --json output follows the contract', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts?.['import:drafta'] ?? '', 'package.json has no import:drafta script').toContain(EXPORTER);

    const w = world({ notes: [ID.helloEn] });
    const { code, json } = runExporter(w, ['--commit']);
    expect(code).toBe(0);
    for (const key of CONTRACT_KEYS) expect(json, `JSON has no "${key}"`).toHaveProperty(key);
    expect(json.created).toEqual([expect.objectContaining({ title: 'Hello world', slug: 'hello-world', lang: 'en' })]);
    expect(json.created[0].url).toMatch(/\/blog\/hello-world\/$/);
  });

  it('selects by #drafta/blog in the body and by extraTags, pairing EN and RU under one slug', () => {
    const w = world({ notes: [ID.helloEn, ID.helloRu] });
    const { json } = runExporter(w, ['--commit']);
    expect(slugs(json.created).sort()).toEqual(['en/hello-world', 'ru/hello-world']);

    const en = w.readSitePost('src/content/blog/en/hello-world.md');
    const ru = w.readSitePost('src/content/blog/ru/hello-world.md');
    expect(en.data).toMatchObject({ title: 'Hello world', lang: 'en', slug: 'hello-world', draftaId: ID.helloEn });
    // customTitle wins over the first "# " heading, as displayTitle does in the app.
    expect(ru.data).toMatchObject({ title: 'Здравствуй мир', lang: 'ru', slug: 'hello-world', draftaId: ID.helloRu });
    for (const post of [en, ru]) expect(post.body).not.toMatch(/```site/);
  });

  it('copies an attachment found only in the legacy root next to the post and rewrites the link', () => {
    const w = world({ notes: [ID.helloEn] });
    const { json } = runExporter(w, ['--commit']);
    expect(json.errors).toEqual([]);
    const copied = readFileSync(w.sitePath('src/content/blog/en/hello-world/diagram.png'));
    expect(copied.equals(readFileSync(join(FIXTURE, 'attachments', ID.helloEn, 'diagram.png')))).toBe(true);
    const md = w.readSite('src/content/blog/en/hello-world.md');
    expect(md).toContain('./hello-world/diagram.png');
    expect(md).not.toContain('attachment://');
  });

  it('a second run over an unchanged library commits nothing', () => {
    const w = world({ notes: [ID.helloEn, ID.helloRu] });
    const first = runExporter(w, ['--commit']).json;
    expect(first.committed).toBe(true);
    expect(first.sha).toBe(w.head());

    const headBefore = w.head();
    const second = runExporter(w, ['--commit']);
    expect(second.code).toBe(0);
    expect(second.json).toMatchObject({ committed: false, created: [], updated: [], deleted: [] });
    expect(w.head()).toBe(headBefore);
    expect(git(w.siteDir, 'status', '--porcelain')).toBe('');
  });
});

describe('ЗАДАЧА-2.2 exporter — refusals', () => {
  it('skips a note tagged only #blog and a sealed note, each with its reason', () => {
    const w = world({ notes: [ID.hashBlog, ID.sealed] });
    const { code, json } = runExporter(w, ['--commit']);
    expect(code).toBe(0);
    expect(json.created).toEqual([]);
    expect(json.errors).toEqual([]);
    expect(titles(json.skipped)).toContain('Just a blog note');
    const sealed = json.skipped.find((s) => s.title === 'Sealed note' || /06000000/.test(JSON.stringify(s)));
    expect(sealed?.reason, 'sealed note is not skipped as sealed').toMatch(/sealed/i);
    expect(w.siteHas('src/content/blog/en/just-blog.md')).toBe(false);
  });

  it('unpublishes a trashed note and a note whose file is gone, with their attachment folders', () => {
    const w = world({
      notes: [ID.trashed],
      site: {
        'src/content/blog/en/trashed-post.md': sitePost({ title: 'Trashed post', slug: 'trashed-post', draftaId: ID.trashed }),
        'src/content/blog/en/trashed-post/old.png': 'png',
        'src/content/blog/en/vanished-post.md': sitePost({ title: 'Vanished post', slug: 'vanished-post', draftaId: ID.vanished }),
        'src/content/blog/en/vanished-post/old.png': 'png',
      },
    });
    const { json } = runExporter(w, ['--commit']);
    expect(slugs(json.deleted).sort()).toEqual(['en/trashed-post', 'en/vanished-post']);
    for (const rel of ['trashed-post.md', 'trashed-post', 'vanished-post.md', 'vanished-post']) {
      expect(w.siteHas(`src/content/blog/en/${rel}`), rel).toBe(false);
    }
    expect(json.committed).toBe(true);
  });

  it('leaves a file owned by another draftaId untouched and reports the collision', () => {
    const foreignFile = sitePost({ title: 'Someone else', slug: 'taken-slug', draftaId: ID.foreign });
    const w = world({ notes: [ID.collision, ID.helloEn], site: { 'src/content/blog/en/taken-slug.md': foreignFile } });
    const { code, json } = runExporter(w, ['--commit']);
    expect(code).toBe(1);
    expect(titles(json.errors)).toContain('Slug collision');
    expect(w.readSite('src/content/blog/en/taken-slug.md')).toBe(foreignFile);
    expect(slugs(json.created)).toEqual(['en/hello-world']);
  });

  it('reports a missing attachment as an error and still exports the other notes', () => {
    const w = world({ notes: [ID.brokenAttachment, ID.helloEn] });
    const { code, json } = runExporter(w, ['--commit']);
    expect(code).toBe(1);
    const error = json.errors.find((e) => e.title === 'Broken attachment');
    expect(error?.message ?? '', 'no error for the missing attachment').toContain('nope.png');
    expect(w.siteHas('src/content/blog/en/missing-attachment.md')).toBe(false);
    expect(slugs(json.created)).toEqual(['en/hello-world']);
    expect(w.siteHas('src/content/blog/en/hello-world.md')).toBe(true);
  });
});
