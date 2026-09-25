// Owner's decisions (wave 2) on translation:
// - two Russian posts that link each other get English twins in one run, and
//   each twin links the other twin under its English title;
// - a link never points at an English page that does not exist: when the
//   hand-written English twin fails to build, a machine twin stands in for it
//   and the translated page links that;
// - a translation the provider was paid for is never lost: when the push is
//   rejected it is reported as translated or deferred (reason git), and
//   translationChars counts every paid character.
import { chmodSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { git, makeWorld } from '../helpers/library.mjs';
import { translateRun, writeNote } from '../helpers/note-file.mjs';

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
});
function world() {
  const w = makeWorld({ notes: [] });
  cleanups.push(w.cleanup);
  return w;
}

const ruSite = (slug) => [`slug: ${slug}`, 'lang: ru', 'description: Связанные заметки', 'date: 2026-09-20'];
const A = { title: 'Заметка про сад', slug: 'sad' };
const B = { title: 'Заметка про лес', slug: 'les' };
const EN = (slug) => `src/content/blog/en/${slug}.md`;
const linkTo = (path) => new RegExp(`\\]\\((https://drafta\\.org)?${path.replace(/\//g, '\\/')}\\)`);

function linkedPair(w) {
  writeNote(w, { title: A.title, site: ruSite(A.slug), body: `Смотри также [[${B.title}]].` });
  writeNote(w, { title: B.title, site: ruSite(B.slug), body: `Смотри также [[${A.title}]].` });
}

describe('translated twins: links and paid work', () => {
  it('A ↔ B translated in one run: each English twin links the other English twin under its English title', () => {
    const w = world();
    linkedPair(w);
    const r = translateRun(w);
    expect(r.json.translated.map((t) => t.slug).sort(), JSON.stringify(r.json.translationDeferred)).toEqual([B.slug, A.slug].sort());

    const enA = w.readSitePost(EN(A.slug));
    const enB = w.readSitePost(EN(B.slug));
    for (const [from, to, toSlug] of [[enA, enB, B.slug], [enB, enA, A.slug]]) {
      const label = String(to.data.title);
      expect(label, 'the English twin has a title of its own').not.toMatch(/[а-яё]/i);
      expect(from.body).toMatch(linkTo(`/blog/${toSlug}/`));
      expect(from.body).toContain(`[${label}](`);
      expect(from.body).not.toMatch(linkTo(`/ru/blog/${toSlug}/`));
    }
  });

  it('B has a hand-written English note that fails to build → the English A links B\'s machine twin, a page that exists', () => {
    const w = world();
    linkedPair(w);
    writeNote(w, {
      title: 'About the forest',
      site: [`slug: ${B.slug}`, 'lang: en', 'description: Hand-written, broken', 'date: 2026-09-20'],
      body: '![Gone](attachment://00000000-0000-4000-8000-00000000DEAD/nope.png)',
    });
    const r = translateRun(w);
    expect(w.siteHas(EN(A.slug)), JSON.stringify({ errors: r.json.errors, deferred: r.json.translationDeferred })).toBe(true);

    // The broken hand-written twin does not ship, so B gets a machine twin in
    // the same run — and A may link it, because that page exists.
    const enA = w.readSitePost(EN(A.slug)).body;
    const enB = w.readSitePost(EN(B.slug));
    expect(enB.data.machineTranslated, 'the machine twin stands in for the broken hand-written one').toBe(true);
    expect(enA).toMatch(linkTo(`/blog/${B.slug}/`));
    expect(enA).toContain(`[${String(enB.data.title)}](`);
  });

  it('push rejected during translation of 3 jobs: every paid translation is translated or deferred for git, chars all counted', () => {
    const notes = [
      { title: 'Первая заметка', slug: 'pervaya' },
      { title: 'Вторая заметка', slug: 'vtoraya' },
      { title: 'Третья заметка', slug: 'tretya' },
    ];
    const addNotes = (w) => notes.forEach((n) => writeNote(w, { title: n.title, site: ruSite(n.slug), body: `Текст заметки «${n.title}».` }));

    // Baseline: the same three jobs with nothing in the way — what they cost.
    const base = world();
    addNotes(base);
    const paid = translateRun(base);
    expect(paid.json.translated).toHaveLength(3);
    expect(paid.json.translationChars).toBeGreaterThan(0);

    // A real bare remote: the originals' push is accepted, then someone else
    // pushes to main, so every later push is a non-fast-forward rejection.
    const w = world();
    addNotes(w);
    const remote = `${w.home}/remote.git`;
    git(w.home, 'init', '-q', '--bare', '-b', 'main', remote);
    git(w.siteDir, 'remote', 'add', 'origin', remote);
    git(w.siteDir, 'push', '-q', '-u', 'origin', 'main');
    installForeignPushAfterFirst(remote);

    const r = translateRun(w, ['--commit', '--push', '--branch', 'main', '--translate']);
    expect(r.requests.length, 'all three jobs were paid for').toBe(paid.requests.length);

    const translated = r.json.translated ?? [];
    const deferred = r.json.translationDeferred ?? [];
    for (const n of notes) {
      const reported = [...translated, ...deferred].filter((t) => t.slug === n.slug);
      expect(reported, `paid translation "${n.slug}" is missing from translated and translationDeferred; errors: ${JSON.stringify(r.json.errors)}`).toHaveLength(1);
    }
    expect(deferred.length, 'the rejected push must defer at least one translation').toBeGreaterThan(0);
    for (const d of deferred) expect(`${d.reason} ${d.detail ?? ''}`).toMatch(/git|push/i);
    expect(r.json.translationChars).toBe(paid.json.translationChars);
  });
});

/**
 * post-receive hook of the bare remote: after the first accepted push it adds
 * a commit of its own on main — the "someone else pushed" of real life.
 */
function installForeignPushAfterFirst(remote) {
  const hook = [
    '#!/bin/sh',
    'read old new ref',
    '[ -e foreign-done ] && exit 0',
    'touch foreign-done',
    'export GIT_AUTHOR_NAME=Other GIT_AUTHOR_EMAIL=other@example.invalid GIT_COMMITTER_NAME=Other GIT_COMMITTER_EMAIL=other@example.invalid',
    'tree=$(git rev-parse "$new^{tree}")',
    'c=$(git commit-tree "$tree" -p "$new" -m "foreign commit")',
    'git update-ref "$ref" "$c"',
    '',
  ].join('\n');
  writeExecutable(`${remote}/hooks/post-receive`, hook);
}

function writeExecutable(file, text) {
  writeFileSync(file, text);
  chmodSync(file, 0o755);
}
