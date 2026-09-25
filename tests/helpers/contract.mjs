// Loads a module that a wave-2 task promised in PLAN v2 §11.2/§11.3. A missing
// file or export fails with the owning task in the message, so a red test says
// "not built yet" instead of a resolver stack trace.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '@astrojs/internal-helpers/frontmatter';
import { ROOT } from './dist.mjs';

export function contractFile(rel, task) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) throw new Error(`${rel} не существует — контракт ЗАДАЧИ-${task}`);
  return file;
}

export async function importContract(rel, task) {
  const file = contractFile(rel, task);
  return import(/* @vite-ignore */ file);
}

/** The first of `names` that `mod` exports as a function. */
export function contractFn(mod, names, rel, task) {
  const name = names.find((n) => typeof mod[n] === 'function');
  if (!name) throw new Error(`${rel}: нет экспорта ${names.join(' | ')} — контракт ЗАДАЧИ-${task}`);
  return mod[name];
}

/**
 * Front matter parsed exactly as Astro parses it (js-yaml via
 * @astrojs/internal-helpers), so an unquoted date becomes a Date here just as
 * it does in the build.
 */
export function parseMarkdown(text) {
  const src = text.startsWith('---') ? text : `---\n${text.trimEnd()}\n---\n`;
  const { frontmatter, content } = parseFrontmatter(src);
  return { data: frontmatter, body: content };
}
