#!/usr/bin/env node
// Drafta library → drafta.org content (PLAN v2 §4, §11.3, ЗАДАЧА-2.2).
//
//   node scripts/import-from-drafta.mjs [--library <dir>] [--site <dir>]
//     [--commit] [--push --branch <b>] [--adopt] [--translate] [--json]
//
// Default is a dry run: it prints `note → path → action (reason)` and touches
// nothing. `--commit` writes the pages and commits only the paths it touched;
// `--push` then pushes HEAD to origin/<branch> (fast-forward only). `--json`
// prints one JSON object — the contract the publisher (ЗАДАЧА-2.4) reads.
// Exit 0 on success (including "nothing to import"), 1 on any export or git error.
//
// `--translate` (with `--commit`; PLAN v2 §11.9): after the originals are
// committed and pushed, each Russian page without a hand-written English twin
// gets a machine translation; all translations of the run go into one commit
// and one push, so no page reaches origin ahead of a twin it links to. Provider and key come only
// from env: DRAFTA_AI_PROVIDER, DRAFTA_AI_KEY. DRAFTA_TRANSLATE_MAX_CHARS caps
// the characters sent this run; DRAFTA_TRANSLATE_HOLD (`slug:sourceHash,…`)
// names translations the publisher is backing off from. A failed translation
// never fails the run: it is reported in `translationDeferred`.
//
// All file and git IO lives here; the rules live in scripts/lib/*.mjs.
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  attachmentRoots,
  candidatePaths,
  clashingNames,
  coverRef,
  findAttachmentRefs,
  isSafeAttachmentName,
  rewriteAttachmentRefs,
} from './lib/attachments.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { aheadOfOrigin, commitPaths, currentBranch, defaultExec, pushFastForward } from './lib/git.mjs';
import { decodeNote } from './lib/notes.mjs';
import { TRANSLATION_DIRECTIONS, buildPlan, contentDirs, pageTarget, renderPage, withoutTitleLine } from './lib/plan.mjs';
import { PublishConfigError, readPublishConfig } from './lib/publish-config.mjs';
import { sectionTagsFor, selectNote, skipReasons } from './lib/select.mjs';
import { isValidSlug } from './lib/site-block.mjs';
import { removeTags } from './lib/tags.mjs';
import { MINUTE_MS } from './lib/time.mjs';
import { rewriteWikilinks, titleKey } from './lib/wikilinks.mjs';
import { languageName } from './translate/prompt.mjs';
import { DEFAULT_MAX_CHARS_PER_RUN, parseHold, runTranslations } from './translate/policy.mjs';
import { createTranslator, documentChars, sourceHash } from './translate/translate.mjs';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_LIBRARY = join(homedir(), 'Library/Application Support/Drafta/Library');
const NOTE_FILE = /\.md$/;
const EXIT_OK = 0;
const EXIT_FAILED = 1;
// The translation step stops taking new work after this long: a hung provider
// must not hold the publisher's lock.
const DEFAULT_TRANSLATE_MAX_MS = 5 * MINUTE_MS;

// The AI key is for the provider only: git and ssh (hooks, credential helpers)
// never see it.
const AI_ENV_KEYS = ['DRAFTA_AI_KEY', 'DRAFTA_AI_PROVIDER'];

function withoutAiEnv(env) {
  const rest = { ...env };
  for (const key of AI_ENV_KEYS) delete rest[key];
  return rest;
}

const gitExec = (file, args, options) => defaultExec(file, args, { ...options, env: withoutAiEnv(process.env) });

const USAGE = `Usage: npm run import:drafta -- [--library <dir>] [--site <dir>] [--commit] [--push --branch <b>] [--adopt] [--translate] [--json]
  (no flags)   dry run: print the plan, change nothing
  --commit     write the pages and commit the touched paths
  --push       after the commit, push HEAD to origin/<branch> (fast-forward only)
  --adopt      take over site files that carry no Drafta draftaId
  --translate  with --commit: machine-translate Russian pages into English
               (env DRAFTA_AI_PROVIDER, DRAFTA_AI_KEY)
  --json       print one JSON object instead of the table`;

function readOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      library: { type: 'string', default: DEFAULT_LIBRARY },
      site: { type: 'string', default: REPO_ROOT },
      commit: { type: 'boolean', default: false },
      push: { type: 'boolean', default: false },
      branch: { type: 'string' },
      adopt: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      translate: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  return values;
}

function usageError(options) {
  if (options.push && !options.branch) return '--push needs --branch <b>';
  if (options.push && !options.commit) return '--push needs --commit';
  return null;
}

// ── Library ────────────────────────────────────────────────────────────────

function noteIdFromFile(file) {
  return basename(file).replace(NOTE_FILE, '').toUpperCase();
}

/**
 * Reads and judges every note of the library. A candidate's body has the site's
 * section tags already cut out: they are publishing switches, not text.
 * @param {{blog: string, docs: string}} sectionTags the tags that publish to this site
 * @returns {{candidates: object[], skipped: object[], errors: object[], skippedIds: Map, protectedIds: Set}}
 */
function readLibrary(library, sectionTags) {
  const notesDir = join(library, 'notes');
  const SKIP = skipReasons(sectionTags);
  const switches = Object.values(sectionTags);
  const result = { candidates: [], skipped: [], errors: [], skippedIds: new Map(), protectedIds: new Set() };
  for (const file of readdirSync(notesDir).filter((name) => NOTE_FILE.test(name)).sort()) {
    const decoded = decodeNote(readFileSync(join(notesDir, file), 'utf8'));
    const fileId = noteIdFromFile(file);
    if (decoded.kind !== 'note') {
      result.protectedIds.add(decoded.id?.toUpperCase() ?? fileId);
      const reason = decoded.kind === 'sealed' ? SKIP.sealed : `unreadable: ${decoded.reason}`;
      result.skipped.push({ title: decoded.title ?? file, reason });
      continue;
    }
    const { note } = decoded;
    const verdict = selectNote(note, sectionTags);
    if (verdict.verdict === 'skip') {
      result.skippedIds.set(note.id, verdict.reason);
      result.skipped.push({ title: note.title, reason: verdict.reason });
    } else if (verdict.verdict === 'error') {
      result.protectedIds.add(note.id);
      result.errors.push({ title: note.title, message: verdict.message, noteId: note.id });
    } else {
      const target = pageTarget(verdict.section, verdict.site.lang, verdict.site.slug);
      result.candidates.push({ note, ...verdict, body: removeTags(verdict.body, switches), target });
    }
  }
  return result;
}

// ── Attachments ────────────────────────────────────────────────────────────

function isPlainFile(path) {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

/** The first root that holds the file, or an error message naming the file. */
function locateAttachment(ref, roots) {
  if (!isSafeAttachmentName(ref.name)) return { error: `attachment name "${ref.name}" is not a plain file name` };
  const source = candidatePaths(ref, roots).find(isPlainFile);
  if (!source) return { error: `attachment ${ref.noteId}/${ref.name} is in neither ${roots.join(' nor ')}` };
  return { asset: { name: ref.name, source } };
}

function sameBytes(a, b) {
  return isPlainFile(b) && readFileSync(a).equals(readFileSync(b));
}

/** Which of the page's assets differ on the site, and which files in its folder are no longer linked. */
function compareAssets(site, assetDir, assets) {
  const dir = join(site, assetDir);
  const changed = assets.filter((asset) => !sameBytes(asset.source, join(dir, asset.name))).map((a) => a.name);
  const wanted = new Set(assets.map((asset) => asset.name));
  const present = existsSync(dir) ? readdirSync(dir).filter((name) => isPlainFile(join(dir, name))) : [];
  return { changed, stale: present.filter((name) => !wanted.has(name)) };
}

// ── Pages ──────────────────────────────────────────────────────────────────

/** `<lang>\n<title key>` → the exported page a [[wiki link]] with that title means. */
function titleIndex(candidates) {
  const index = new Map();
  for (const { note, site, section, target } of candidates) {
    const key = `${site.lang}\n${titleKey(note.title)}`;
    if (!index.has(key)) index.set(key, { sitePath: target.sitePath, section, slug: site.slug });
  }
  return index;
}

const twinKey = (section, slug) => `${section}/${slug}`;

/**
 * `<section>/<slug>` → the page in the translation's target language that
 * stands for the original with that slug: a hand-written note in that
 * language, or a machine translation already on the site. Translations made
 * later in this run are added as they are built (see translateJob).
 */
function twinIndex(candidates, existing) {
  const twins = new Map();
  const targetLangs = new Set(Object.values(TRANSLATION_DIRECTIONS));
  for (const file of existing) {
    if (targetLangs.has(file.lang) && file.machineTranslated) twins.set(twinKey(file.section, file.slug), { sitePath: file.sitePath, title: file.title });
  }
  for (const { note, site, section, target } of candidates) {
    if (targetLangs.has(site.lang)) twins.set(twinKey(section, site.slug), { sitePath: target.sitePath, title: note.title });
  }
  return twins;
}

/**
 * How a [[wiki link]] resolves on this version of the page. On the original,
 * a title names a note of the page's own language. On a machine translation
 * the title is still the original's (§11.9 п. 3 keeps [[…]] out of the
 * model's hands): the link goes to that note's twin in the translation's
 * language under the twin's title, or, without a twin, to the original.
 */
function linkResolver({ links, twins }, version) {
  const own = (title) => links.get(`${version.lang}\n${titleKey(title)}`)?.sitePath ?? null;
  if (!version.machine) return own;
  return (title) => {
    const source = links.get(`${version.from}\n${titleKey(title)}`);
    if (!source) return own(title);
    const twin = twins.get(twinKey(source.section, source.slug));
    return twin ? { url: twin.sitePath, label: twin.title } : { url: source.sitePath, label: title };
  };
}

/** The note's Markdown as the site shows it, before links and attachments are rewritten. */
function sourceBody(candidate) {
  return withoutTitleLine(candidate.body);
}

/** The note as written: its own language, title, description and body. */
function originalVersion(candidate) {
  return {
    lang: candidate.site.lang,
    title: candidate.note.title,
    description: candidate.site.description,
    body: sourceBody(candidate),
    target: candidate.target,
  };
}

/**
 * Turns one selected note into a page, or an error when a linked file is missing.
 * @param {object} [version] which text to publish — the original, or a machine
 *   translation {lang, title, description, body, target, machine}
 * @returns {{page?: object, error?: string, warnings: string[]}}
 */
function buildPage(candidate, context, version = originalVersion(candidate)) {
  const { roots, site } = context;
  const { note, section } = candidate;
  const { target } = version;
  const fields = { ...candidate.site, lang: version.lang, description: version.description };
  const linked = rewriteWikilinks(version.body, linkResolver(context, version));
  const warnings = [...candidate.warnings, ...linked.warnings];

  const refs = findAttachmentRefs(linked.body);
  const cover = section === 'blog' && fields.cover ? coverRef(note.id, fields.cover) : null;
  const clashes = clashingNames(cover ? [...refs, cover] : refs);
  if (clashes.length > 0) return { error: `two attachments would both be saved as ${clashes.join(', ')}`, warnings };

  const located = [...refs, ...(cover ? [cover] : [])].map((ref) => locateAttachment(ref, roots));
  const failures = located.filter((result) => result.error).map((result) => result.error);
  if (failures.length > 0) return { error: failures.join('; '), warnings };
  const assets = [...new Map(located.map(({ asset }) => [asset.name, asset])).values()];

  const text = renderPage({
    note,
    section,
    site: fields,
    tags: candidate.tags,
    body: rewriteAttachmentRefs(linked.body, refs, fields.slug),
    cover: cover ? `./${fields.slug}/${cover.name}` : undefined,
    title: version.title,
    machine: version.machine,
  });
  const page = {
    noteId: note.id,
    title: version.title,
    section,
    lang: fields.lang,
    slug: fields.slug,
    ...target,
    text,
    assetFiles: assets,
    assets: compareAssets(site, target.assetDir, assets),
  };
  return { page, warnings };
}

// ── Site ───────────────────────────────────────────────────────────────────

function readSiteFiles(site) {
  const files = [];
  for (const { section, lang, dir } of contentDirs()) {
    const absolute = join(site, dir);
    if (!existsSync(absolute)) continue;
    for (const name of readdirSync(absolute).filter((file) => NOTE_FILE.test(file))) {
      const path = `${dir}/${name}`;
      if (!isPlainFile(join(site, path))) continue;
      const text = readFileSync(join(site, path), 'utf8');
      const { data } = parseFrontmatter(text);
      const slug = name.replace(NOTE_FILE, '');
      // A file the exporter would never have written (`..md`, `Draft Copy.md`)
      // is not its to judge or delete — and its "asset folder" could be anything.
      if (!isValidSlug(slug)) continue;
      const target = pageTarget(section, lang, slug);
      files.push({
        ...target,
        section,
        lang,
        slug,
        text,
        title: typeof data.title === 'string' ? data.title : slug,
        draftaId: typeof data.draftaId === 'string' ? data.draftaId : undefined,
        machineTranslated: data.machineTranslated === true,
        translation: data.translation && typeof data.translation === 'object' ? data.translation : undefined,
      });
    }
  }
  return files;
}

function writePage(site, { page }) {
  const dir = join(site, page.assetDir);
  for (const name of page.assets.stale) rmSync(join(dir, name), { force: true });
  if (page.assetFiles.length > 0) mkdirSync(dir, { recursive: true });
  for (const asset of page.assetFiles) copyFileSync(asset.source, join(dir, asset.name));
  if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
  writeFileSync(join(site, page.path), page.text);
}

/** Removes a page and its attachments — only ever `<section dir>/<slug>` of a valid slug. */
function removePage(site, entry) {
  if (!isValidSlug(entry.slug) || entry.assetDir !== pageTarget(entry.section, entry.lang, entry.slug).assetDir) {
    throw new Error(`refusing to remove ${entry.assetDir}: not a page folder of slug "${entry.slug}"`);
  }
  rmSync(join(site, entry.path), { force: true });
  rmSync(join(site, entry.assetDir), { recursive: true, force: true });
}

/** Applies the plan to the working tree; returns the paths it touched. */
function applyPlan(site, plan) {
  const touched = [];
  for (const entry of [...plan.create, ...plan.update]) {
    writePage(site, entry);
    touched.push(entry.page.path, entry.page.assetDir);
  }
  for (const entry of plan.delete) {
    removePage(site, entry);
    touched.push(entry.path, entry.assetDir);
  }
  return touched;
}

// ── Translation ────────────────────────────────────────────────────────────

const BANNERS = {
  en: (from, href) => `Translated automatically from ${languageName(from)} · <a href="${href}">Read the original →</a>`,
};

function envNumber(value, fallback) {
  const number = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(number) && number >= 0 ? number : fallback;
}

/** The translated text as a page of the target language, marked as a machine translation. */
function translatedVersion(job, candidate, done) {
  const original = pageTarget(job.section, job.from, job.slug);
  return {
    lang: job.to,
    from: job.from,
    title: done.title,
    description: done.description,
    body: done.body,
    target: pageTarget(job.section, job.to, job.slug),
    machine: {
      translation: done.translation,
      banner: job.section === 'docs' ? BANNERS[job.to]?.(job.from, original.sitePath) : undefined,
    },
  };
}

function usageDelta(before, after) {
  return {
    inputTokens: after.inputTokens - before.inputTokens,
    outputTokens: after.outputTokens - before.outputTokens,
    requests: after.requests - before.requests,
  };
}

/** Writes every translation of the run and commits them together; returns the commit sha. */
async function commitTranslations(options, pages) {
  for (const { page } of pages) writePage(options.site, { page });
  const paths = pages.flatMap(({ page }) => [page.path, page.assetDir]);
  const commit = await commitPaths(options.site, paths, translationCommitMessage(pages), { exec: gitExec });
  return commit.committed ? commit.sha : undefined;
}

function translationCommitMessage(pages) {
  if (pages.length === 1) {
    const { job } = pages[0];
    return `content: translate ${job.slug} (${job.from}→${job.to})`;
  }
  return `content: translate ${pages.length} pages from Drafta`;
}

/** @returns {Promise<boolean>} whether a push happened */
async function pushTranslations(options) {
  if (!options.push) return false;
  return (await pushFastForward(options.site, options.branch, { exec: gitExec })).pushed;
}

/**
 * Phase 1 of a job: the model call. A problem with the text or the provider
 * throws TranslationDeferred; the caller turns everything else into a deferral too.
 */
async function translateJob(job, source, translator) {
  const before = { ...translator.usage };
  const done = await translator.translateDocument(source, { from: job.from, to: job.to });
  return { done, usage: usageDelta(before, translator.usage), model: done.translation.model };
}

/**
 * Phase 2, for every translation of the run at once: the pages are built only
 * after every model call, with the run's own translations already in the twin
 * index, so a translated page links a twin translated in the same run. A twin
 * that fails to build is taken out of the index and the rest is built again.
 * (A twin that only appears in a future run is not linked: the page is cached
 * by its source hash and does not change until its original does.)
 * @param {{job: object, done: object}[]} items
 * @returns {({page: object} | {error: string})[]} aligned with `items`
 */
function buildTranslations(items, { candidates, context }) {
  const versions = items.map(({ job, done }) => ({ job, version: translatedVersion(job, candidates.get(job.noteId), done) }));
  // What the index held before this run's translations — a machine twin
  // already on the site — comes back for a translation that fails to build.
  const before = new Map(versions.map(({ job }) => [twinKey(job.section, job.slug), context.twins.get(twinKey(job.section, job.slug))]));
  const seedTwins = (skip) => {
    for (const { job, version } of versions) {
      const key = twinKey(job.section, job.slug);
      const previous = before.get(key);
      if (!skip.has(job)) context.twins.set(key, { sitePath: version.target.sitePath, title: version.title });
      else if (previous) context.twins.set(key, previous);
      else context.twins.delete(key);
    }
  };
  const buildAll = () => versions.map(({ job, version }) => buildPage(candidates.get(job.noteId), context, version));
  seedTwins(new Set());
  let built = buildAll();
  const failed = new Set(versions.filter((_, i) => !built[i].page).map(({ job }) => job));
  if (failed.size > 0) {
    seedTwins(failed);
    built = buildAll();
  }
  return built.map((result) => (result.page ? { page: result.page } : { error: result.error }));
}

/** The translation step of a committed run: the IO around scripts/translate/policy.mjs. */
function translateAll(options, run, env) {
  const candidates = new Map(run.library.candidates.map((candidate) => [candidate.note.id, candidate]));
  const sources = new Map(run.plan.translate.map((job) => [job.noteId, originalVersion(candidates.get(job.noteId))]));
  const now = () => new Date();
  const translator = createTranslator({
    fetch: globalThis.fetch,
    now,
    provider: env.DRAFTA_AI_PROVIDER,
    key: env.DRAFTA_AI_KEY,
    deadline: new Date(now().getTime() + envNumber(env.DRAFTA_TRANSLATE_MAX_MS, DEFAULT_TRANSLATE_MAX_MS)),
  });
  const jobs = run.plan.translate.map((job) => {
    const source = sources.get(job.noteId);
    return { job, hash: sourceHash(source), chars: documentChars(source) };
  });
  const limits = {
    budget: envNumber(env.DRAFTA_TRANSLATE_MAX_CHARS, DEFAULT_MAX_CHARS_PER_RUN),
    hold: parseHold(env.DRAFTA_TRANSLATE_HOLD),
    provider: env.DRAFTA_AI_PROVIDER,
  };
  return runTranslations(jobs, limits, {
    translate: (job) => translateJob(job, sources.get(job.noteId), translator),
    build: (items) => buildTranslations(items, { candidates, context: run.context }),
    commit: (pages) => commitTranslations(options, pages),
    push: () => pushTranslations(options),
  });
}

// ── Output ─────────────────────────────────────────────────────────────────

const publicEntry = ({ title, slug, lang, url, section, path }) => ({ title, slug, lang, url, section, path });
/** `published` — the broken note's page is still on the site (§11.1: never taken down by an error). */
const publicError = ({ title, message, published }) => ({ title, message, ...(published ? { published: true } : {}) });

function report(plan, library, extra) {
  return {
    created: plan.create.map(publicEntry),
    updated: plan.update.map((entry) => ({ ...publicEntry(entry), ...(entry.replacedAuto ? { replacedAuto: true } : {}) })),
    deleted: plan.delete.map((entry) => ({ ...publicEntry(entry), reason: entry.reason })),
    unchanged: plan.unchanged.map(publicEntry),
    skipped: library.skipped,
    errors: [...library.errors, ...plan.errors, ...extra.errors].map(publicError),
    warnings: extra.warnings,
    committed: extra.committed,
    ...(extra.sha ? { sha: extra.sha } : {}),
    pushed: extra.pushed,
    translated: extra.translated,
    translationDeferred: extra.translationDeferred,
    translationChars: extra.translationChars,
  };
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/** @param {object[]} planned translation jobs a dry run would attempt */
function printTable(result, { commit }, planned) {
  const rows = [
    ...result.created.map((e) => [e.title, e.path, 'create']),
    ...result.updated.map((e) => [e.title, e.path, e.replacedAuto ? 'replace-auto' : 'update']),
    ...result.deleted.map((e) => [e.title, e.path, `delete (${e.reason})`]),
    ...result.unchanged.map((e) => [e.title, e.path, 'unchanged']),
    ...result.errors.map((e) => [e.title, '—', `error (${e.message})`]),
    ...result.skipped.map((e) => [e.title, '—', `skip (${e.reason})`]),
  ];
  for (const [title, path, action] of rows) console.log(`${title} → ${path} → ${action}`);
  for (const job of planned) console.log(`${job.title} → ${job.path} → translate ${job.from}→${job.to}${job.existing ? ' (check cache)' : ''}`);
  for (const t of result.translated) console.log(`${t.title} → ${t.path ?? '—'} → translated ${t.from}→${t.to}${t.cached ? ' (cached)' : ''}`);
  for (const d of result.translationDeferred) console.log(`${d.title} → — → translation deferred (${d.reason}${d.detail ? `: ${d.detail}` : ''})`);
  for (const warning of result.warnings) console.log(`warning: ${warning.title}: ${warning.message}`);

  const skipSummary = countBy(result.skipped, 'reason').map(([reason, n]) => `${reason}: ${n}`).join(', ');
  console.log('');
  console.log(
    `create ${result.created.length}, update ${result.updated.length}, delete ${result.deleted.length}, ` +
      `unchanged ${result.unchanged.length}, error ${result.errors.length}, skip ${result.skipped.length}` +
      (skipSummary ? ` (${skipSummary})` : ''),
  );
  if (!commit) console.log('dry run — nothing written; add --commit to apply');
  else if (result.committed) console.log(`committed ${result.sha}${result.pushed ? ', pushed' : ''}`);
  else console.log('nothing to import');
}

// ── Run ────────────────────────────────────────────────────────────────────

/** Builds every candidate's page; a candidate whose page cannot be built is reported in `failed`. */
function buildPages(candidates, context) {
  const out = { pages: [], failed: [], warnings: [] };
  for (const candidate of candidates) {
    const built = buildPage(candidate, context);
    out.warnings.push(...built.warnings.map((message) => ({ title: candidate.note.title, message })));
    if (built.page) out.pages.push(built.page);
    else out.failed.push({ candidate, error: built.error });
  }
  return out;
}

function planRun(options, { tagNamespace }) {
  const library = readLibrary(options.library, sectionTagsFor(tagNamespace));
  const roots = attachmentRoots(options.library);
  let linkable = library.candidates;
  let context = { links: titleIndex(linkable), roots, site: options.site };
  let built = buildPages(library.candidates, context);
  if (built.failed.length > 0) {
    // A wiki-link must not point at a page that is not going out: rebuild
    // without the failed notes in the index (a page fails on its attachments,
    // not on its links, so the second pass fails the same notes).
    const failedIds = new Set(built.failed.map(({ candidate }) => candidate.note.id));
    linkable = library.candidates.filter((candidate) => !failedIds.has(candidate.note.id));
    context = { ...context, links: titleIndex(linkable) };
    built = buildPages(library.candidates, context);
  }
  const { pages, warnings } = built;
  for (const { candidate, error } of built.failed) {
    library.protectedIds.add(candidate.note.id);
    library.errors.push({ title: candidate.note.title, message: error });
  }
  const existing = readSiteFiles(options.site);
  markStillPublished(library.errors, existing);
  context.twins = twinIndex(linkable, existing);
  const plan = buildPlan({
    pages,
    existing,
    skipped: library.skippedIds,
    protectedIds: library.protectedIds,
    adopt: options.adopt,
  });
  return { library, plan, warnings, context };
}

/** A note whose site block broke keeps its page on the site (protected) — the owner must hear that. */
function markStillPublished(errors, existing) {
  const onSite = new Set(existing.map((file) => file.draftaId).filter(Boolean));
  for (const error of errors) {
    if (error.noteId && onSite.has(error.noteId)) error.published = true;
  }
}

// Builds `content: publish <slug>` for a single change, or
// `content: publish 2, update 1, unpublish 1 from Drafta` once several
// notes moved — one clause per non-empty category, in publish/update/unpublish order.
function importCommitMessage(plan) {
  const categories = [
    { action: 'publish', entries: plan.create },
    { action: 'update', entries: plan.update },
    { action: 'unpublish', entries: plan.delete },
  ].filter(({ entries }) => entries.length > 0);
  const total = categories.reduce((sum, { entries }) => sum + entries.length, 0);
  if (total === 1) {
    const { action, entries } = categories[0];
    return `content: ${action} ${entries[0].slug}`;
  }
  const clauses = categories.map(({ action, entries }) => `${action} ${entries.length}`);
  return `content: ${clauses.join(', ')} from Drafta`;
}

/** `--push --branch <b>` is honoured only from <b> itself: a working copy on another branch never has its commits pushed there. */
async function assertOnPushBranch({ site, branch }) {
  const checkedOut = await currentBranch(site, { exec: gitExec });
  if (checkedOut !== branch) {
    throw new Error(`--push --branch ${branch}, but the checked-out branch is ${checkedOut ?? 'detached'} — refusing`);
  }
}

async function publish(options, plan) {
  const outcome = { committed: false, pushed: false, errors: [] };
  try {
    if (options.push) await assertOnPushBranch(options);
    const touched = applyPlan(options.site, plan);
    const commit = await commitPaths(options.site, touched, importCommitMessage(plan), { exec: gitExec });
    Object.assign(outcome, commit.committed ? { committed: true, sha: commit.sha } : {});
    // Also after the publisher's retry: the originals were committed by the previous attempt and are still unpushed.
    if (options.push && (commit.committed || (await aheadOfOrigin(options.site, options.branch, { exec: gitExec })))) {
      outcome.pushed = (await pushFastForward(options.site, options.branch, { exec: gitExec })).pushed;
    }
  } catch (error) {
    outcome.errors.push({ title: 'git', message: (error.stderr || error.message || String(error)).trim() });
  }
  return outcome;
}

async function main(argv) {
  const options = readOptions(argv);
  if (options.help) {
    console.log(USAGE);
    return EXIT_OK;
  }
  const problem = usageError(options);
  if (problem) {
    reportFailure(options.json, 'usage', `${problem}\n${USAGE}`);
    return EXIT_FAILED;
  }

  let config;
  try {
    config = readPublishConfig(options.site);
  } catch (error) {
    if (!(error instanceof PublishConfigError)) throw error;
    reportFailure(options.json, 'config', error.message);
    return EXIT_FAILED;
  }

  const run = planRun(options, config);
  const emptiness = libraryLooksEmpty(run);
  if (emptiness) {
    reportFailure(options.json, 'library looks empty', emptiness);
    return EXIT_FAILED;
  }
  const outcome = options.commit ? await publish(options, run.plan) : { committed: false, pushed: false, errors: [] };
  // Rule 5: translation starts only once the originals are committed.
  const translating = options.translate && options.commit && outcome.errors.length === 0;
  const translation = translating ? await translateAll(options, run, process.env) : NO_TRANSLATION;
  const result = report(run.plan, run.library, {
    ...outcome,
    committed: outcome.committed || Boolean(translation.sha),
    sha: translation.sha ?? outcome.sha,
    pushed: outcome.pushed || translation.pushed,
    errors: [...outcome.errors, ...translation.errors],
    warnings: run.warnings,
    translated: translation.translated,
    translationDeferred: translation.deferred,
    translationChars: translation.chars,
  });

  if (options.json) console.log(JSON.stringify(result));
  else printTable(result, options, options.translate && !options.commit ? run.plan.translate : []);
  return result.errors.length > 0 ? EXIT_FAILED : EXIT_OK;
}

const NO_TRANSLATION = Object.freeze({ translated: [], deferred: [], chars: 0, sha: undefined, pushed: false, errors: [] });

// A library that publishes nothing yet asks to take down more pages than this
// is far more likely wrong (moved, half-synced, wrong --library) than emptied
// on purpose: the run stops before it unpublishes anything.
const MAX_UNPUBLISH_WITHOUT_CANDIDATES = 3;

/** @returns {string|null} why the run refuses to apply the plan */
function libraryLooksEmpty({ library, plan }) {
  if (library.candidates.length > 0 || plan.delete.length <= MAX_UNPUBLISH_WITHOUT_CANDIDATES) return null;
  return `no note is selected for the site, yet ${plan.delete.length} published pages would be removed — refusing (check --library)`;
}

/** A run that failed before it had a plan still owes `--json` callers one JSON object. */
function reportFailure(json, title, message) {
  console.error(`import-from-drafta: ${title}: ${message}`);
  if (!json) return;
  const empty = { created: [], updated: [], deleted: [], unchanged: [], skipped: [], warnings: [], translated: [], translationDeferred: [] };
  console.log(JSON.stringify({ ...empty, errors: [{ title, message }], committed: false, pushed: false }));
}

const argv = process.argv.slice(2);
main(argv).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    reportFailure(argv.includes('--json'), 'export', error.message);
    process.exitCode = EXIT_FAILED;
  },
);
