#!/usr/bin/env node
// Drafta library → drafta.org content (PLAN v2 §4, §11.3, ЗАДАЧА-2.2).
//
//   node scripts/import-from-drafta.mjs [--library <dir>] [--site <dir>]
//     [--commit] [--push --branch <b>] [--adopt] [--json]
//
// Default is a dry run: it prints `note → path → action (reason)` and touches
// nothing. `--commit` writes the pages and commits only the paths it touched;
// `--push` then pushes HEAD to origin/<branch> (fast-forward only). `--json`
// prints one JSON object — the contract the publisher (ЗАДАЧА-2.4) reads.
// Exit 0 on success (including "nothing to import"), 1 on any export or git error.
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
import { commitPaths, pushFastForward } from './lib/git.mjs';
import { decodeNote } from './lib/notes.mjs';
import { buildPlan, contentDirs, pageTarget, renderPage, withoutTitleLine } from './lib/plan.mjs';
import { SECTION_TAGS, SKIP, selectNote } from './lib/select.mjs';
import { removeTags } from './lib/tags.mjs';
import { rewriteWikilinks, titleKey } from './lib/wikilinks.mjs';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_LIBRARY = join(homedir(), 'Library/Application Support/Drafta/Library');
const NOTE_FILE = /\.md$/;
const EXIT_OK = 0;
const EXIT_FAILED = 1;

const USAGE = `Usage: npm run import:drafta -- [--library <dir>] [--site <dir>] [--commit] [--push --branch <b>] [--adopt] [--json]
  (no flags)   dry run: print the plan, change nothing
  --commit     write the pages and commit the touched paths
  --push       after the commit, push HEAD to origin/<branch> (fast-forward only)
  --adopt      take over site files that carry no Drafta draftaId
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
 * Reads and judges every note of the library.
 * @returns {{candidates: object[], skipped: object[], errors: object[], skippedIds: Map, protectedIds: Set}}
 */
function readLibrary(library) {
  const notesDir = join(library, 'notes');
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
    const verdict = selectNote(note);
    if (verdict.verdict === 'skip') {
      result.skippedIds.set(note.id, verdict.reason);
      result.skipped.push({ title: note.title, reason: verdict.reason });
    } else if (verdict.verdict === 'error') {
      result.protectedIds.add(note.id);
      result.errors.push({ title: note.title, message: verdict.message });
    } else {
      result.candidates.push({ note, ...verdict, target: pageTarget(verdict.section, verdict.site.lang, verdict.site.slug) });
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

function titleIndex(candidates) {
  const index = new Map();
  for (const { note, site, target } of candidates) {
    const key = `${site.lang}\n${titleKey(note.title)}`;
    if (!index.has(key)) index.set(key, target.sitePath);
  }
  return index;
}

/**
 * Turns one selected note into a page, or an error when a linked file is missing.
 * @returns {{page?: object, error?: string, warnings: string[]}}
 */
function buildPage(candidate, { links, roots, site }) {
  const { note, section, site: fields, target } = candidate;
  const stripped = removeTags(withoutTitleLine(candidate.body), Object.values(SECTION_TAGS));
  const linked = rewriteWikilinks(stripped, (title) => links.get(`${fields.lang}\n${titleKey(title)}`) ?? null);
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
  });
  const page = {
    noteId: note.id,
    title: note.title,
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
      const target = pageTarget(section, lang, slug);
      files.push({
        ...target,
        section,
        lang,
        slug,
        text,
        title: typeof data.title === 'string' ? data.title : slug,
        draftaId: typeof data.draftaId === 'string' ? data.draftaId : undefined,
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

function removePage(site, entry) {
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

// ── Output ─────────────────────────────────────────────────────────────────

const publicEntry = ({ title, slug, lang, url, section, path }) => ({ title, slug, lang, url, section, path });

function report(plan, library, extra) {
  return {
    created: plan.create.map(publicEntry),
    updated: plan.update.map(publicEntry),
    deleted: plan.delete.map((entry) => ({ ...publicEntry(entry), reason: entry.reason })),
    unchanged: plan.unchanged.map(publicEntry),
    skipped: library.skipped,
    errors: [...library.errors, ...plan.errors, ...extra.errors],
    warnings: extra.warnings,
    committed: extra.committed,
    ...(extra.sha ? { sha: extra.sha } : {}),
    pushed: extra.pushed,
  };
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function printTable(result, { commit }) {
  const rows = [
    ...result.created.map((e) => [e.title, e.path, 'create']),
    ...result.updated.map((e) => [e.title, e.path, 'update']),
    ...result.deleted.map((e) => [e.title, e.path, `delete (${e.reason})`]),
    ...result.unchanged.map((e) => [e.title, e.path, 'unchanged']),
    ...result.errors.map((e) => [e.title, '—', `error (${e.message})`]),
    ...result.skipped.map((e) => [e.title, '—', `skip (${e.reason})`]),
  ];
  for (const [title, path, action] of rows) console.log(`${title} → ${path} → ${action}`);
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

function planRun(options) {
  const library = readLibrary(options.library);
  const links = titleIndex(library.candidates);
  const roots = attachmentRoots(options.library);
  const pages = [];
  const warnings = [];
  for (const candidate of library.candidates) {
    const built = buildPage(candidate, { links, roots, site: options.site });
    warnings.push(...built.warnings.map((message) => ({ title: candidate.note.title, message })));
    if (built.page) {
      pages.push(built.page);
    } else {
      library.protectedIds.add(candidate.note.id);
      library.errors.push({ title: candidate.note.title, message: built.error });
    }
  }
  const plan = buildPlan({
    pages,
    existing: readSiteFiles(options.site),
    skipped: library.skippedIds,
    protectedIds: library.protectedIds,
    adopt: options.adopt,
  });
  return { library, plan, warnings };
}

async function publish(options, plan) {
  const outcome = { committed: false, pushed: false, errors: [] };
  const changes = plan.create.length + plan.update.length + plan.delete.length;
  try {
    const touched = applyPlan(options.site, plan);
    const commit = await commitPaths(options.site, touched, `content: import ${changes} notes from Drafta`);
    Object.assign(outcome, commit.committed ? { committed: true, sha: commit.sha } : {});
    if (options.push) outcome.pushed = (await pushFastForward(options.site, options.branch)).pushed;
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
  if (options.translate) {
    reportFailure(options.json, '--translate', 'not implemented yet (ЗАДАЧА-2.5)');
    return EXIT_FAILED;
  }
  const problem = usageError(options);
  if (problem) {
    reportFailure(options.json, 'usage', `${problem}\n${USAGE}`);
    return EXIT_FAILED;
  }

  const { library, plan, warnings } = planRun(options);
  const outcome = options.commit ? await publish(options, plan) : { committed: false, pushed: false, errors: [] };
  const result = report(plan, library, { ...outcome, warnings });

  if (options.json) console.log(JSON.stringify(result));
  else printTable(result, options);
  return result.errors.length > 0 ? EXIT_FAILED : EXIT_OK;
}

/** A run that failed before it had a plan still owes `--json` callers one JSON object. */
function reportFailure(json, title, message) {
  console.error(`import-from-drafta: ${title}: ${message}`);
  if (!json) return;
  const empty = { created: [], updated: [], deleted: [], unchanged: [], skipped: [], warnings: [] };
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
