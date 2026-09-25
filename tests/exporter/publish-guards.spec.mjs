// Guards of the exporter CLI found by the wave-2 review (PLAN v2 §11.1, §11.10,
// owner's decisions of 2026-09-25):
// - a library that selects nothing while the site has several published pages
//   is taken for a wrong/half-synced library: the run stops, nothing removed;
// - the site's publish.config.json is mandatory — without it the exporter does
//   not guess a tag namespace;
// - only the site's own namespace publishes: the old `#site/blog` tag no longer does.
// Runs the real CLI on a fixture world (tests/helpers/library.mjs).
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ID, git, makeWorld, runExporter, sitePost, slugs, titles } from '../helpers/library.mjs';

const worlds = [];
function world(opts) {
  const w = makeWorld(opts);
  worlds.push(w);
  return w;
}
afterEach(() => {
  while (worlds.length) worlds.pop().cleanup();
});

const messages = (json) => (json.errors ?? []).map((e) => `${e.title ?? ''} ${e.message ?? ''}`).join('\n');

describe('review — exporter guards', () => {
  it('library selects nothing, site has 4 published pages: exit 1, "library looks empty", nothing removed', () => {
    const ids = ['01000000-0000-4000-8000-000000000001', '02000000-0000-4000-8000-000000000002', '03000000-0000-4000-8000-000000000003', ID.vanished];
    const site = Object.fromEntries(
      ids.map((draftaId, i) => [`src/content/blog/en/post-${i}.md`, sitePost({ title: `Post ${i}`, slug: `post-${i}`, draftaId })]),
    );
    const w = world({ notes: [], site });
    const head = w.head();

    const { code, json } = runExporter(w, ['--commit']);

    expect(code).toBe(1);
    expect(messages(json)).toMatch(/empty/i);
    expect(json.deleted ?? []).toEqual([]);
    for (const rel of Object.keys(site)) expect(w.siteHas(rel), `${rel} was removed`).toBe(true);
    expect(w.head()).toBe(head);
  });

  it('no publish.config.json in --site: exit 1 with one JSON naming the file, nothing exported', () => {
    const w = world({ notes: [ID.helloEn] });
    rmSync(w.sitePath('publish.config.json'));
    git(w.siteDir, 'commit', '-q', '-am', 'drop publish config');
    const head = w.head();

    const { code, json } = runExporter(w, ['--commit']);

    expect(code).toBe(1);
    expect(messages(json)).toMatch(/publish\.config\.json/);
    expect(json.created ?? []).toEqual([]);
    expect(json.committed).toBe(false);
    expect(w.siteHas('src/content/blog/en/hello-world.md')).toBe(false);
    expect(w.head()).toBe(head);
  });

  it('a Completed note with a site block but the old #site/blog tag is skipped for its tag', () => {
    const w = world({ notes: [ID.helloEn] });
    const file = join(w.library, 'notes', `${ID.helloEn}.md`);
    const before = readFileSync(file, 'utf8');
    const after = before.replace(/#drafta\/blog/g, '#site/blog').replace(/ #drafta\b/g, '');
    if (after === before) throw new Error('test setup: the fixture note has no #drafta/blog tag');
    writeFileSync(file, after);

    const { json } = runExporter(w, ['--commit']);

    expect(slugs(json.created)).not.toContain('en/hello-world');
    expect(w.siteHas('src/content/blog/en/hello-world.md')).toBe(false);
    expect(titles(json.skipped)).toContain('Hello world');
    const reason = json.skipped.find((s) => s.title === 'Hello world').reason;
    expect(reason).toMatch(/tag/i);
  });
});
