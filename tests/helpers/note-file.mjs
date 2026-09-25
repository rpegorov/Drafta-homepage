// Writes an ad-hoc Drafta note into a makeWorld() library, in the same shape
// as the fixture notes (front matter, H1, ```site block, #drafta/blog in the
// body). For cases the fixed fixture does not cover: dates, wikilinks, several
// Russian originals at once.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './dist.mjs';
import { runExporter } from './library.mjs';

export const FAKE_PROVIDER = join(ROOT, 'tests/helpers/fake-provider.mjs');

let seq = 0;
/** A fresh uppercase UUID-shaped id, unique within the test process. */
export function noteId() {
  seq += 1;
  return `${String(seq).padStart(8, '0')}-AAAA-4000-8000-${String(seq).padStart(12, '0')}`;
}

/**
 * @param {{library: string}} world
 * @param {{id?: string, title: string, site: string[], body?: string,
 *   createdAt?: string, updatedAt?: string}} note site — lines of the site block
 * @returns {string} the note id
 */
export function writeNote(world, { id = noteId(), title, site, body = 'Текст заметки.', createdAt = '2026-09-20T09:00:00.000Z', updatedAt = createdAt }) {
  const text = [
    '---',
    `id: ${id}`,
    `title: ${title}`,
    'schemaVersion: 1',
    `createdAt: ${createdAt}`,
    `updatedAt: ${updatedAt}`,
    'status: completed',
    '---',
    `# ${title}`,
    '',
    '```site',
    ...site,
    '```',
    '',
    `${body} #drafta/blog`,
    '',
  ].join('\n');
  writeFileSync(join(world.library, 'notes', `${id}.md`), text);
  return id;
}

let runNo = 0;
/** One exporter run with --translate against the fake provider; returns its provider requests too. */
export function translateRun(world, args = ['--commit', '--translate'], env = {}) {
  const log = join(world.home, `provider-${(runNo += 1)}.log`);
  const fullEnv = { DRAFTA_AI_PROVIDER: 'anthropic', DRAFTA_AI_KEY: 'sk-ant-fake', FAKE_PROVIDER_MODE: 'echo', FAKE_PROVIDER_LOG: log, ...env };
  const r = runExporter(world, args, { env: fullEnv, preload: FAKE_PROVIDER });
  const requests = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { ...r, requests };
}
