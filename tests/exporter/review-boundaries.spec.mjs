// Boundaries found by the wave-2 review (PLAN v2 §11.1 п. 8–9, §11.4 "Снятие
// публикации", §4 "tags"), with the orchestrator's decisions of 2026-09-25:
// - any `publish:` value other than true in the site block unpublishes;
// - `publish: false` wins even when the rest of the site block is broken;
// - a note that loses Completed is unpublished with its attachment folder;
// - `tags:` on the site are the tags written in the note's text, minus
//   `site/*`; front-matter `extraTags` never leak onto the page.
// Each test publishes a fixture note first, then edits the note in the fake
// library the way the app would, and reruns the real CLI.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ID, git, makeWorld, runExporter, slugs } from '../helpers/library.mjs';

const POST = 'src/content/blog/en/hello-world.md';
const POST_DIR = 'src/content/blog/en/hello-world';

const worlds = [];
function world(opts) {
  const w = makeWorld(opts);
  worlds.push(w);
  return w;
}
afterEach(() => {
  while (worlds.length) worlds.pop().cleanup();
});

function editNote(w, id, edit) {
  const file = join(w.library, 'notes', `${id}.md`);
  const before = readFileSync(file, 'utf8');
  const after = edit(before);
  if (after === before) throw new Error(`test setup: edit did not change note ${id}`);
  writeFileSync(file, after);
}

/** Adds lines to the note's ```site block, right after its description. */
const addToSiteBlock = (lines) => (md) => md.replace(/^(description: .*)$/m, `$1\n${lines}`);

/** Publishes Hello world (with its attachment) and returns the world. */
function published() {
  const w = world({ notes: [ID.helloEn] });
  const first = runExporter(w, ['--commit']);
  expect(slugs(first.json.created), 'setup: Hello world was not published').toEqual(['en/hello-world']);
  expect(w.siteHas(`${POST_DIR}/diagram.png`), 'setup: attachment was not copied').toBe(true);
  return w;
}

/** The post and its attachment folder are gone in a new deletion commit. */
function expectUnpublished(w, run, headBefore) {
  expect(slugs(run.json.deleted)).toContain('en/hello-world');
  expect(w.siteHas(POST), 'post file still on the site').toBe(false);
  expect(w.siteHas(POST_DIR), 'attachment folder still on the site').toBe(false);
  expect(run.json.committed).toBe(true);
  expect(w.head()).not.toBe(headBefore);
  const removed = git(w.siteDir, 'show', '--name-status', '--format=', 'HEAD');
  expect(removed).toMatch(new RegExp(`^D\\s+${POST}$`, 'm'));
  expect(removed).toMatch(new RegExp(`^D\\s+${POST_DIR}/diagram.png$`, 'm'));
}

describe('ЗАДАЧА-2.2 review — unpublishing', () => {
  it('`publish: false` in the site block removes a published post and its attachments', () => {
    const w = published();
    const head = w.head();
    editNote(w, ID.helloEn, addToSiteBlock('publish: false'));
    expectUnpublished(w, runExporter(w, ['--commit']), head);
  });

  it('`publish: False` and `publish: no` unpublish too — any value but true stops publishing', () => {
    for (const value of ['False', 'no']) {
      const w = published();
      const head = w.head();
      editNote(w, ID.helloEn, addToSiteBlock(`publish: ${value}`));
      expectUnpublished(w, runExporter(w, ['--commit']), head);
    }
  });

  it('`publish: false` still unpublishes when the site block also has an invalid date', () => {
    const w = published();
    const head = w.head();
    editNote(w, ID.helloEn, (md) => addToSiteBlock('publish: false')(md).replace(/^date: .*$/m, 'date: 2026-13-45'));
    expectUnpublished(w, runExporter(w, ['--commit']), head);
  });

  it('a note moved from Completed back to Active is removed from the site', () => {
    const w = published();
    const head = w.head();
    editNote(w, ID.helloEn, (md) => md.replace(/^status: completed$/m, 'status: active'));
    expectUnpublished(w, runExporter(w, ['--commit']), head);
  });
});

describe('ЗАДАЧА-2.2 review — tags', () => {
  it('front-matter extraTags stay off the page; text tags go on it, site/* never', () => {
    const w = world({ notes: [ID.helloEn] });
    editNote(w, ID.helloEn, (md) => md.replace(/^status: completed$/m, 'status: completed\nextraTags:\n- private-idea\n- site/blog'));
    const { json } = runExporter(w, ['--commit']);
    expect(slugs(json.created)).toEqual(['en/hello-world']);

    const tags = w.readSitePost(POST).data.tags ?? [];
    expect(tags).toContain('drafta');
    expect(tags).not.toContain('private-idea');
    expect(tags.filter((t) => String(t).startsWith('site'))).toEqual([]);
  });
});
