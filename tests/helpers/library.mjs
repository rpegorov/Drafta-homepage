// A throwaway world for the exporter CLI: a fake $HOME holding a copy of the
// fixture Drafta data (tests/fixtures/library mirrors
// "~/Library/Application Support/Drafta/": Library/ is the library root with
// notes/, library.json and the new attachments root; attachments/ next to it is
// the legacy root), plus a site clone that is a real git repository.
// The exporter runs as a child process exactly as the publisher runs it
// (PLAN v2 §11.3 "CLI экспортёра"), with HOME pointing at the fake home so both
// attachment roots resolve inside it.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { contractFile, parseMarkdown } from './contract.mjs';
import { ROOT } from './dist.mjs';

export const FIXTURE = join(ROOT, 'tests/fixtures/library');
export const EXPORTER = 'scripts/import-from-drafta.mjs';

export const ID = {
  helloEn: '0A000000-0000-4000-8000-00000000000A',
  helloRu: '0B000000-0000-4000-8000-00000000000B',
  hashBlog: '0C000000-0000-4000-8000-00000000000C',
  trashed: '0D000000-0000-4000-8000-00000000000D',
  collision: '0E000000-0000-4000-8000-00000000000E',
  brokenAttachment: '0F000000-0000-4000-8000-00000000000F',
  sealed: '06000000-0000-4000-8000-000000000006',
  docs: '08000000-0000-4000-8000-000000000008',
  ruOnly: '07000000-0000-4000-8000-000000000007',
  enTwinOfRu: '09000000-0000-4000-8000-000000000009',
  enOnly: '05000000-0000-4000-8000-000000000005',
  // Not in the library: a note the owner deleted (trash auto-sweep).
  vanished: '04000000-0000-4000-8000-000000000004',
  // Owns a slug on the site but is not the colliding note.
  foreign: 'FFFFFFFF-0000-4000-8000-0000000000FF',
};

const SITE_DIRS = ['src/content/blog/en', 'src/content/blog/ru', 'src/content/docs/docs', 'src/content/docs/ru/docs'];
const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Tester',
  GIT_AUTHOR_EMAIL: 'tester@example.invalid',
  GIT_COMMITTER_NAME: 'Tester',
  GIT_COMMITTER_EMAIL: 'tester@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1',
};

export function git(dir, ...args) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV, HOME: dir } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

/** A site post file as the exporter would have written it earlier. */
export function sitePost({ title, slug, lang = 'en', draftaId, extra = '' }) {
  const id = draftaId ? `draftaId: ${draftaId}\n` : '';
  return `---\ntitle: ${title}\ndescription: Published earlier\nlang: ${lang}\nslug: ${slug}\ndate: '2026-09-01'\nupdated: '2026-09-01'\n${id}tags: []\n${extra}---\n\nPublished earlier.\n`;
}

/**
 * @param {{notes: string[], site?: Record<string, string|Buffer>}} opts
 *   notes — ids of fixture notes copied into the library (attachments are
 *   always copied whole); site — files the site clone already has.
 */
export function makeWorld({ notes, site = {} }) {
  const home = mkdtempSync(join(tmpdir(), 'drafta-export-'));
  const drafta = join(home, 'Library/Application Support/Drafta');
  const library = join(drafta, 'Library');
  mkdirSync(join(library, 'notes'), { recursive: true });
  cpSync(join(FIXTURE, 'Library/library.json'), join(library, 'library.json'));
  cpSync(join(FIXTURE, 'Library/attachments'), join(library, 'attachments'), { recursive: true });
  cpSync(join(FIXTURE, 'attachments'), join(drafta, 'attachments'), { recursive: true });
  for (const id of notes) cpSync(join(FIXTURE, 'Library/notes', `${id}.md`), join(library, 'notes', `${id}.md`));

  const siteDir = join(home, 'site');
  for (const dir of SITE_DIRS) {
    mkdirSync(join(siteDir, dir), { recursive: true });
    writeFileSync(join(siteDir, dir, '.gitkeep'), '');
  }
  for (const [rel, content] of Object.entries(site)) {
    mkdirSync(dirname(join(siteDir, rel)), { recursive: true });
    writeFileSync(join(siteDir, rel), content);
  }
  git(siteDir, 'init', '-q', '-b', 'main');
  git(siteDir, 'add', '-A');
  git(siteDir, 'commit', '-q', '-m', 'site before import');

  return {
    home,
    library,
    siteDir,
    sitePath: (rel) => join(siteDir, rel),
    siteHas: (rel) => existsSync(join(siteDir, rel)),
    readSite: (rel) => readFileSync(join(siteDir, rel), 'utf8'),
    readSitePost: (rel) => parseMarkdown(readFileSync(join(siteDir, rel), 'utf8')),
    head: () => git(siteDir, 'rev-parse', 'HEAD'),
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  };
}

/**
 * Runs the exporter CLI with --json and returns its parsed JSON.
 * @param {string[]} args extra flags (e.g. ['--commit'])
 * @param {{env?: object, preload?: string}} opts preload — a module loaded
 *   with `node --import` before the exporter (fake network boundary).
 */
export function runExporter(world, args = [], { env = {}, preload } = {}) {
  const script = contractFile(EXPORTER, '2.2');
  const baseEnv = { ...process.env };
  delete baseEnv.DRAFTA_AI_KEY;
  delete baseEnv.DRAFTA_AI_PROVIDER;
  const r = spawnSync(
    process.execPath,
    [...(preload ? ['--import', preload] : []), script, '--library', world.library, '--site', world.siteDir, ...args, '--json'],
    { cwd: ROOT, encoding: 'utf8', timeout: 60000, env: { ...baseEnv, ...GIT_ENV, HOME: world.home, ...env } },
  );
  let json;
  try {
    json = JSON.parse(r.stdout.trim());
  } catch {
    throw new Error(`${EXPORTER} --json did not print one JSON object (exit ${r.status}).\nstdout: ${r.stdout.slice(0, 800)}\nstderr: ${r.stderr.slice(0, 800)}`);
  }
  return { code: r.status, json, stderr: r.stderr };
}

export const titles = (entries = []) => entries.map((e) => e.title);
export const slugs = (entries = []) => entries.map((e) => `${e.lang ?? ''}/${e.slug ?? ''}`);
