// The ```site block — the only carrier of site data inside a note, because the
// app's codec drops front matter keys it does not know (PLAN v2 §4 п. 2, §11.3).
//
//   ```site
//   slug: mcp-server
//   lang: ru
//   description: Что умеет встроенный MCP-сервер
//   order: 40            # docs: sidebar.order
//   date: 2026-10-01     # blog: publication date (default: createdAt)
//   cover: cover.png     # blog: OG picture, from the note's attachments
//   publish: false       # take the page down now, whatever the status
//   ```
//
// A comment is whitespace + `#` + whitespace (or end of line), so hashtags
// inside a description (`#drafta`) survive.
import { isClosingFence, openingFence, splitFences } from './tags.mjs';

const BLOCK_INFO = 'site';
const LANGS = ['en', 'ru'];
const DEFAULT_LANG = 'en';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const COMMENT = /\s#(?:\s.*)?$/;
const KNOWN_KEYS = ['slug', 'lang', 'description', 'date', 'order', 'cover', 'publish'];

function unquote(value) {
  const quoted = /^"(.*)"$/.exec(value) ?? /^'(.*)'$/.exec(value);
  return quoted ? quoted[1] : null;
}

function parseLine(line) {
  const match = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
  if (!match) return null;
  const [, key, rest] = match;
  const raw = rest.trim();
  const quoted = unquote(raw);
  return { key, value: quoted ?? raw.replace(COMMENT, '').trim() };
}

/**
 * Reads the key/value lines of a site block into validated fields.
 * @returns {{fields: object, problems: string[], warnings: string[]}}
 *   problems — values that make the block unusable; warnings — ignorable.
 */
export function parseSiteFields(lines) {
  const fields = {};
  const problems = [];
  const warnings = [];
  for (const line of lines) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const entry = parseLine(line);
    if (!entry) {
      warnings.push(`site block: unreadable line "${line.trim()}"`);
    } else if (!KNOWN_KEYS.includes(entry.key)) {
      warnings.push(`site block: unknown key "${entry.key}"`);
    } else {
      fields[entry.key] = entry.value;
    }
  }
  return { ...validate(fields, problems), problems, warnings };
}

function validate(raw, problems) {
  const fields = { lang: raw.lang || DEFAULT_LANG, publish: true };
  if (raw.slug) {
    if (SLUG.test(raw.slug)) fields.slug = raw.slug;
    else problems.push(`slug "${raw.slug}" is not lowercase-latin-with-dashes`);
  }
  if (!LANGS.includes(fields.lang)) problems.push(`lang "${fields.lang}" is not en or ru`);
  if (raw.description) fields.description = raw.description;
  if (raw.date) {
    if (DATE_ONLY.test(raw.date)) fields.date = raw.date;
    else problems.push(`date "${raw.date}" is not YYYY-MM-DD`);
  }
  if (raw.order) {
    const order = Number(raw.order);
    if (Number.isInteger(order)) fields.order = order;
    else problems.push(`order "${raw.order}" is not an integer`);
  }
  if (raw.cover) fields.cover = raw.cover;
  if (raw.publish !== undefined) {
    if (raw.publish === 'true' || raw.publish === 'false') fields.publish = raw.publish === 'true';
    else problems.push(`publish "${raw.publish}" is not true or false`);
  }
  return { fields };
}

/**
 * Finds the first ```site fenced block of a note body and cuts it out.
 * @returns {{found: boolean, fields: object, problems: string[], warnings: string[], body: string}}
 *   body — the note body without the block (and without the blank line after it).
 */
export function extractSiteBlock(body) {
  const segments = splitFences(body);
  const index = segments.findIndex((segment) => segment.kind === 'fence' && segment.info === BLOCK_INFO);
  if (index < 0) return { found: false, fields: {}, problems: [], warnings: [], body };

  const block = segments[index];
  const closed = block.lines.length > 1 && isClosingFence(block.lines.at(-1), openingFence(block.lines[0]));
  const inner = block.lines.slice(1, closed ? -1 : undefined);
  const parsed = parseSiteFields(inner);

  const rest = segments.filter((_, i) => i !== index);
  const next = segments[index + 1];
  if (next?.kind === 'prose' && next.lines[0].trim() === '') {
    rest[index] = { ...next, lines: next.lines.slice(1) };
  }
  const remaining = rest.flatMap((segment) => segment.lines).join('\n');
  return { found: true, ...parsed, body: remaining };
}
