// Owner's decisions (wave 2): a post carries its day as `date` and its
// publication instant as `published`, both reckoned in Europe/Moscow. The site
// block may give `YYYY-MM-DD` or `YYYY-MM-DD HH:MM`; whatever it leaves out
// comes from the note's createdAt in the owner's zone. A malformed or
// impossible date is an error of that one note — the rest of the run ships.
import { afterEach, describe, expect, it } from 'vitest';
import { makeWorld, runExporter, slugs } from '../helpers/library.mjs';
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

const ruSite = (slug, ...extra) => [`slug: ${slug}`, 'lang: ru', 'description: Проверка даты', ...extra];

/** One note per bad date plus one good note; returns the run and the titles. */
function runWithBadDates(dates) {
  const w = world();
  const bad = dates.map((date, i) => {
    const title = `Плохая дата ${i + 1}`;
    writeNote(w, { title, site: ruSite(`bad-${i + 1}`, `date: ${date}`) });
    return title;
  });
  writeNote(w, { title: 'Хорошая дата', site: ruSite('good', 'date: 2026-09-20') });
  return { w, bad, r: runExporter(w, ['--commit']) };
}

function expectOnlyBadNotesFail({ w, bad, r }, dates) {
  const errored = (r.json.errors ?? []).map((e) => e.title);
  for (const [i, title] of bad.entries()) {
    expect(errored, `date "${dates[i]}" must be an error of note "${title}"; errors: ${JSON.stringify(r.json.errors)}`).toContain(title);
    expect(w.siteHas(`src/content/blog/ru/bad-${i + 1}.md`), `a post with date "${dates[i]}" must not be published`).toBe(false);
  }
  expect(errored).not.toContain('Хорошая дата');
  expect(slugs(r.json.created)).toContain('ru/good');
  expect(w.siteHas('src/content/blog/ru/good.md')).toBe(true);
  expect(r.json.committed).toBe(true);
}

describe('publication date and instant (Europe/Moscow)', () => {
  it('`date: 2026-09-25 18:00` → date "2026-09-25", published 18:00+03:00; the EN translation carries the same published', () => {
    const w = world();
    writeNote(w, { title: 'Вечерний пост', site: ruSite('vecherniy', 'date: 2026-09-25 18:00') });
    const r = translateRun(w);

    const ru = w.readSitePost('src/content/blog/ru/vecherniy.md').data;
    expect(ru.date).toBe('2026-09-25');
    expect(ru.published).toBe('2026-09-25T18:00:00+03:00');
    expect(r.json.translated, JSON.stringify(r.json.translationDeferred)).toContainEqual(expect.objectContaining({ slug: 'vecherniy', to: 'en' }));
    const en = w.readSitePost('src/content/blog/en/vecherniy.md').data;
    expect(en.published).toBe('2026-09-25T18:00:00+03:00');
    expect(en.date).toBe('2026-09-25');
  });

  it('`date: 2026-09-25` without a time takes the time of createdAt in Moscow', () => {
    const w = world();
    writeNote(w, { title: 'Ночной пост', site: ruSite('nochnoy', 'date: 2026-09-25'), createdAt: '2026-09-24T22:30:00.000Z' });
    runExporter(w, ['--commit']);

    const ru = w.readSitePost('src/content/blog/ru/nochnoy.md').data;
    expect(ru.date).toBe('2026-09-25');
    expect(ru.published).toBe('2026-09-25T01:30:00+03:00');
  });

  it('no `date`: date and updated are the Moscow day of createdAt/updatedAt, not the UTC day', () => {
    const w = world();
    writeNote(w, { title: 'Пост без даты', site: ruSite('bez-daty'), createdAt: '2026-09-24T22:00:00.000Z', updatedAt: '2026-09-24T22:00:00.000Z' });
    runExporter(w, ['--commit']);

    const ru = w.readSitePost('src/content/blog/ru/bez-daty.md').data;
    expect(ru.date).toBe('2026-09-25');
    expect(ru.updated).toBe('2026-09-25');
  });

  it('impossible calendar dates (2026-13-01, 2026-02-30) are errors of their notes; the other note is published', () => {
    const dates = ['2026-13-01', '2026-02-30'];
    expectOnlyBadNotesFail(runWithBadDates(dates), dates);
  });

  it('`24:00` and the ISO `T` separator are site-block errors; the other note is published', () => {
    const dates = ['2026-09-25 24:00', '2026-09-25T18:00'];
    const run = runWithBadDates(dates);
    expectOnlyBadNotesFail(run, dates);
    for (const title of run.bad) {
      const message = run.r.json.errors.find((e) => e.title === title)?.message ?? '';
      expect(message, `the error of "${title}" must name the date`).toMatch(/date/i);
    }
  });
});
