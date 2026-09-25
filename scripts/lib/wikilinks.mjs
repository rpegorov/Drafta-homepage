// `[[Title]]` / `[[Title|alias]]` → a Markdown link to the exported note with
// that title in the same language, else plain text plus a warning (PLAN v2 §4
// п. 4). The pattern is the app's WikiLinkParser; code is left alone.
import { mapProse } from './tags.mjs';

const WIKILINK = /\[\[\s*([^[\]|\n]+?)(?:\|([^[\]\n]*))?\s*\]\]/g;

/** Title key the app would treat as the same note: trimmed, case-insensitive. */
export function titleKey(title) {
  return title.trim().toLowerCase();
}

/**
 * @param {string} body
 * @param {(title: string) => string | null} resolve URL of the exported note with that title, or null
 * @returns {{body: string, warnings: string[]}}
 */
export function rewriteWikilinks(body, resolve) {
  const warnings = [];
  const rewritten = mapProse(body, (text) =>
    text.replace(WIKILINK, (_match, target, alias) => {
      const title = target.trim();
      const label = alias?.trim() || title;
      const url = resolve(title);
      if (url) return `[${label}](${url})`;
      warnings.push(`[[${title}]] is not a published note in this language — left as text`);
      return label;
    }),
  );
  return { body: rewritten, warnings };
}
