// What the site should hold for the selected notes, and the difference from
// what it holds now: create | update | delete | unchanged, plus errors, plus
// the machine translations the site lacks (translate) — PLAN v2 §11.9.
// Pure: every file read happens in scripts/import-from-drafta.mjs, which hands
// the results in.
import { renderBlogFrontmatter, renderDocsFrontmatter } from './frontmatter.mjs';

export const SITE_URL = 'https://drafta.org';
const DOCS_INDEX_SLUG = 'index';
// Drafta note ids are UUIDs. A file whose draftaId is anything else (the wave-2.0
// fixtures use `fixture-*`) was not written by the exporter and is not its to delete.
const DRAFTA_ID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

// Owner's decision 2026-09-25: Russian originals get an English twin; English
// originals are never translated into Russian.
export const TRANSLATION_DIRECTIONS = Object.freeze({ ru: 'en' });

const SECTION_DIRS = {
  blog: { en: 'src/content/blog/en', ru: 'src/content/blog/ru' },
  docs: { en: 'src/content/docs/docs', ru: 'src/content/docs/ru/docs' },
};

export function isDraftaId(value) {
  return typeof value === 'string' && DRAFTA_ID.test(value);
}

/** The Markdown directories the exporter owns files in, by section and language. */
export function contentDirs() {
  return Object.entries(SECTION_DIRS).flatMap(([section, byLang]) =>
    Object.entries(byLang).map(([lang, dir]) => ({ section, lang, dir })),
  );
}

function pagePath(section, lang, slug) {
  if (section === 'docs' && slug === DOCS_INDEX_SLUG) {
    return lang === 'ru' ? '/ru/docs/' : '/docs/';
  }
  return `${lang === 'ru' ? '/ru' : ''}/${section}/${slug}/`;
}

/**
 * Where a page lives in the repository and on the web.
 * @returns {{path: string, assetDir: string, url: string, sitePath: string}}
 *   path — the Markdown file; assetDir — its attachments folder; sitePath — URL path.
 */
export function pageTarget(section, lang, slug) {
  const dir = SECTION_DIRS[section][lang];
  const sitePath = pagePath(section, lang, slug);
  return { path: `${dir}/${slug}.md`, assetDir: `${dir}/${slug}`, url: `${SITE_URL}${sitePath}`, sitePath };
}

function isoDay(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Drops the note's own title line: the site renders `title` as the page heading. */
export function withoutTitleLine(body) {
  const lines = body.split('\n');
  const rest = /^#\s/.test(lines[0] ?? '') ? lines.slice(1) : lines;
  return `${rest.join('\n').replace(/^\s*\n/, '').trimEnd()}\n`;
}

/**
 * The full Markdown file for one selected note, or for its machine translation.
 * @param {{note: object, section: 'blog'|'docs', site: object, tags: string[], body: string, cover?: string,
 *   title?: string, machine?: {translation: object, banner?: string}}} page
 *   body — final Markdown (links rewritten); cover — `./<slug>/<file>` if the post has one;
 *   title — overrides the note's title (a translated one); machine — marks a machine translation.
 */
export function renderPage({ note, section, site, tags, body, cover, title, machine }) {
  const common = {
    title: title ?? note.title,
    description: site.description,
    updated: isoDay(note.updatedAt),
    draftaId: note.id,
    ...(machine ? { machineTranslated: true, translation: machine.translation } : {}),
  };
  // Docs get no `lang`/`slug`: Starlight reads `slug` as a URL override, and
  // the language comes from the folder.
  const frontmatter =
    section === 'blog'
      ? renderBlogFrontmatter({
          ...common,
          lang: site.lang,
          slug: site.slug,
          date: site.date ?? isoDay(note.createdAt),
          // Also on a translation: the twin sorts next to its original.
          created: new Date(note.createdAt).toISOString(),
          tags,
          cover,
        })
      : renderDocsFrontmatter({ ...common, order: site.order, ...(machine?.banner ? { banner: { content: machine.banner } } : {}) });
  return `${frontmatter}\n${body}`;
}

function entry(page, extra = {}) {
  return { title: page.title, slug: page.slug, lang: page.lang, section: page.section, url: page.url, path: page.path, ...extra };
}

function findCollisions(pages) {
  const byPath = new Map();
  for (const page of pages) byPath.set(page.path, [...(byPath.get(page.path) ?? []), page]);
  return new Set([...byPath.values()].filter((group) => group.length > 1).flat());
}

function ownershipError(page, file, adopt) {
  if (file.draftaId === page.noteId) return null;
  // Rule 1: a hand-written note always wins over a machine translation.
  if (file.machineTranslated) return null;
  const adoptable = !isDraftaId(file.draftaId);
  if (adopt && adoptable) return null;
  if (adoptable) return `${file.path} exists without a Drafta draftaId — rerun with --adopt to take it over`;
  return `slug "${page.slug}" (${page.lang}) is already owned by note ${file.draftaId} at ${file.path}`;
}

/**
 * @param {object} input
 * @param {object[]} input.pages desired pages: {noteId, title, section, lang, slug, path, assetDir, url,
 *   text, assets: {changed: string[], stale: string[]}} — assets as compared by the caller
 * @param {object[]} input.existing site files: {path, assetDir, draftaId?, title, slug, lang, section, url, text,
 *   machineTranslated?, translation?}
 * @param {Map<string,string>} input.skipped noteId → why it is not published (drives delete reasons)
 * @param {Set<string>} input.protectedIds notes on disk this run could not judge (sealed, unreadable,
 *   failed): their files stay as they are
 * @param {boolean} [input.adopt] take over files that carry no Drafta draftaId
 * @returns {{create: object[], update: object[], delete: object[], unchanged: object[], errors: object[],
 *   translate: object[]}} translate — machine translations to make or check against their cache
 */
export function buildPlan({ pages, existing, skipped, protectedIds, adopt = false }) {
  const result = { create: [], update: [], delete: [], unchanged: [], errors: [] };
  const existingByPath = new Map(existing.map((file) => [file.path, file]));
  const keptPaths = new Set();
  const collisions = findCollisions(pages);
  const failedIds = new Set();
  const publishedPaths = new Map(pages.map((page) => [page.noteId, page.path]));

  for (const page of pages) {
    const file = existingByPath.get(page.path);
    if (collisions.has(page)) {
      keptPaths.add(page.path);
      failedIds.add(page.noteId);
      result.errors.push({ title: page.title, message: `another note publishes the same slug "${page.slug}" (${page.lang})` });
      continue;
    }
    if (!file) {
      result.create.push(entry(page, { page }));
      continue;
    }
    keptPaths.add(page.path);
    const conflict = ownershipError(page, file, adopt);
    if (conflict) {
      failedIds.add(page.noteId);
      result.errors.push({ title: page.title, message: conflict });
    } else if (file.text === page.text && page.assets.changed.length === 0 && page.assets.stale.length === 0) {
      result.unchanged.push(entry(page));
    } else {
      const replacedAuto = file.draftaId !== page.noteId && Boolean(file.machineTranslated);
      result.update.push(entry(page, { page, adopted: file.draftaId !== page.noteId && !replacedAuto, replacedAuto }));
    }
  }

  // No translation without an accepted original: a collision or an ownership
  // conflict (both in failedIds) keeps its twin out of the plan.
  const twins = translationTwins(pages.filter((page) => !failedIds.has(page.noteId)));
  const deleting = new Set();

  for (const file of existing) {
    const owner = file.draftaId;
    if (keptPaths.has(file.path) || !isDraftaId(owner) || protectedIds.has(owner) || failedIds.has(owner)) continue;
    if (file.machineTranslated && twins.get(owner)?.path === file.path) continue;
    deleting.add(file.path);
    const movedTo = publishedPaths.get(owner);
    result.delete.push({
      title: file.title,
      slug: file.slug,
      lang: file.lang,
      section: file.section,
      url: file.url,
      path: file.path,
      assetDir: file.assetDir,
      reason: movedTo ? `moved to ${movedTo}` : (skipped.get(owner) ?? 'note removed from the library'),
    });
  }

  result.translate = translationJobs(twins, { existingByPath, keptPaths, deleting });
  return result;
}

/** noteId → where the machine translation of that published page would live. */
function translationTwins(pages) {
  const twins = new Map();
  for (const page of pages) {
    const to = TRANSLATION_DIRECTIONS[page.lang];
    if (!to) continue;
    twins.set(page.noteId, { page, from: page.lang, to, ...pageTarget(page.section, to, page.slug) });
  }
  return twins;
}

/**
 * A twin is translated only where nothing hand-written stands: the path is
 * free, is being deleted in this plan, or holds this note's own machine translation.
 */
function translationJobs(twins, { existingByPath, keptPaths, deleting }) {
  const jobs = [];
  for (const [noteId, twin] of twins) {
    if (keptPaths.has(twin.path)) continue;
    const file = existingByPath.get(twin.path);
    const free = !file || deleting.has(twin.path);
    const ownAuto = file && file.machineTranslated && file.draftaId === noteId;
    if (!free && !ownAuto) continue;
    jobs.push({
      noteId,
      title: twin.page.title,
      slug: twin.page.slug,
      section: twin.page.section,
      from: twin.from,
      to: twin.to,
      path: twin.path,
      assetDir: twin.assetDir,
      url: twin.url,
      existing: ownAuto ? file : null,
    });
  }
  return jobs;
}
