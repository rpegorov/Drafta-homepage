// Reads a Drafta note file the way the app's NoteFileCodec + YAMLFrontmatter
// (Packages/DraftaCore/.../Storage/) do: front matter is the subset the app
// writes — scalars and flow arrays between two exact `---` lines — and the
// title is `customTitle` if set, else the first body line without its `#`s
// (Note.extractTitle, the app's displayTitle).

const DELIMITER = '---';
// Front matter key a sealed file declares (NoteSealing.swift, `schemeField`).
const SEALED_KEY = 'encryption';
const REQUIRED_KEYS = ['id', 'title', 'createdAt', 'updatedAt'];

function unquote(value) {
  if (!(value.length >= 2 && value.startsWith('"') && value.endsWith('"'))) return null;
  const escapes = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' };
  let out = '';
  let escapeNext = false;
  for (const char of value.slice(1, -1)) {
    if (escapeNext) {
      out += escapes[char] ?? char;
      escapeNext = false;
    } else if (char === '\\') {
      escapeNext = true;
    } else {
      out += char;
    }
  }
  return out;
}

function parseValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^[+-]?\d+$/.test(raw)) return Number(raw);
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => {
      const trimmed = item.trim();
      return unquote(trimmed) ?? trimmed;
    });
  }
  return unquote(raw) ?? raw;
}

/** Index of the first `:` outside double quotes, honouring backslash escapes. */
function colonIndex(line) {
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '\\') {
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === ':') {
      return i;
    }
  }
  return -1;
}

/**
 * Splits a note file into its front matter fields and body, or returns null
 * when the file has no front matter (the app treats that file as unusable).
 * @returns {{fields: Record<string, string|number|boolean|string[]>, body: string} | null}
 */
export function splitNoteFile(text) {
  const lines = text.split('\n');
  if (lines[0] !== DELIMITER) return null;
  const end = lines.indexOf(DELIMITER, 1);
  if (end < 0) return null;
  const fields = {};
  for (const rawLine of lines.slice(1, end)) {
    const line = rawLine.trim();
    const colon = colonIndex(line);
    if (!line || colon < 0) continue;
    fields[line.slice(0, colon).trim()] = parseValue(line.slice(colon + 1).trim());
  }
  // YAMLFrontmatter.stripFrontmatter returns the source untouched when nothing follows the closer.
  const body = end + 1 < lines.length ? lines.slice(end + 1).join('\n') : text;
  return { fields, body };
}

/** Note.extractTitle: the first line, trimmed, without leading `#`s. */
export function extractTitle(body) {
  const first = (body.split(/\r\n|\r|\n/)[0] ?? '').trim();
  return first.replace(/^#+\s*/, '');
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Decodes a note file.
 * @param {string} text file contents
 * @returns {{kind: 'note', note: object} | {kind: 'sealed', id?: string, title?: string} | {kind: 'unreadable', reason: string}}
 *   `note` = {id, title, customTitle?, status, trashed, isTemplate, extraTags, createdAt, updatedAt, body}.
 */
export function decodeNote(text) {
  const split = splitNoteFile(text);
  if (!split) return { kind: 'unreadable', reason: 'no front matter' };
  const { fields, body } = split;
  if (fields[SEALED_KEY] !== undefined) {
    return { kind: 'sealed', id: stringField(fields.id), title: stringField(fields.title) };
  }
  const missing = REQUIRED_KEYS.find((key) => typeof fields[key] !== 'string');
  if (missing) return { kind: 'unreadable', reason: `front matter has no ${missing}` };
  if (!isIsoDate(fields.createdAt) || !isIsoDate(fields.updatedAt)) {
    return { kind: 'unreadable', reason: 'front matter dates are not ISO 8601' };
  }
  const customTitle = stringField(fields.customTitle);
  return {
    kind: 'note',
    note: {
      id: fields.id,
      title: customTitle ?? extractTitle(body),
      customTitle,
      status: stringField(fields.status) ?? 'none',
      trashed: fields.trashed === true,
      isTemplate: fields.isTemplate === true,
      extraTags: Array.isArray(fields.extraTags) ? fields.extraTags : [],
      createdAt: fields.createdAt,
      updatedAt: fields.updatedAt,
      body,
    },
  };
}

function stringField(value) {
  return typeof value === 'string' ? value : undefined;
}
