// Port of Drafta's TagExtraction (Packages/DraftaCore/.../Text/TagExtraction.swift).
// Tags are not stored in a note file — the app derives them from the body on
// every load — so the exporter must run the same rules or every note looks
// untagged. It must port `parse`, not `tags(in:)`: the latter keeps only the
// leaf of a path tag, and `#site/blog` would become indistinguishable from
// `#blog` (brain: Drafta TagExtraction.tags returns only the leaf of a path tag).

// ICU `\w` (NSRegularExpression) is Unicode-aware; JS `\w` is ASCII even with
// the `u` flag, so the lookbehind spells ICU's word class out.
const ICU_WORD = String.raw`\p{Alphabetic}\p{M}\p{Nd}\p{Pc}‌‍`;
const TAG_PATTERN = new RegExp(
  String.raw`(?<![${ICU_WORD}&/(])#([a-zA-Zа-яА-ЯёЁ][a-zA-Z0-9а-яА-ЯёЁ_/]{1,})`,
  'gu',
);
const MIN_FENCE_RUN = 3;

function dropIndent(line) {
  return line.replace(/^[ \t]+/, '');
}

function runLength(text, char) {
  let n = 0;
  while (text[n] === char) n += 1;
  return n;
}

/** A fence opener — three or more backticks or tildes after indentation. */
export function openingFence(line) {
  const trimmed = dropIndent(line);
  const char = trimmed[0];
  if (char !== '`' && char !== '~') return null;
  const count = runLength(trimmed, char);
  if (count < MIN_FENCE_RUN) return null;
  return { char, count, info: trimmed.slice(count).trim() };
}

/** A fence closer: the opener's character, at least as many, nothing else but whitespace. */
export function isClosingFence(line, open) {
  const trimmed = dropIndent(line);
  const run = runLength(trimmed, open.char);
  return run >= open.count && /^[ \t]*$/.test(trimmed.slice(run));
}

/**
 * Splits Markdown into prose and fenced-code segments, by the same fence rules
 * TagExtraction masks with. Segments keep their lines verbatim, so joining
 * every segment's lines with "\n" restores the input.
 * @returns {{kind: 'prose'|'fence', info?: string, lines: string[]}[]}
 */
export function splitFences(content) {
  const segments = [];
  let current = null;
  let fence = null;
  const push = (kind, line, info) => {
    if (!current || current.kind !== kind || kind === 'fence' && info !== undefined) {
      current = kind === 'fence' ? { kind, info, lines: [] } : { kind, lines: [] };
      segments.push(current);
    }
    current.lines.push(line);
  };
  for (const line of content.split('\n')) {
    if (fence) {
      push('fence', line);
      if (isClosingFence(line, fence)) {
        fence = null;
        current = null;
      }
      continue;
    }
    const open = openingFence(line);
    if (open) {
      fence = open;
      push('fence', line, open.info);
      continue;
    }
    push('prose', line);
  }
  return segments;
}

/** Removes `code` spans: a backtick run is closed by an equal run; unmatched runs stay. */
export function maskInlineCode(line) {
  let out = '';
  let rest = line;
  for (;;) {
    const start = rest.indexOf('`');
    if (start < 0) break;
    out += rest.slice(0, start);
    const run = runLength(rest.slice(start), '`');
    const closer = '`'.repeat(run);
    const end = rest.indexOf(closer, start + run);
    if (end < 0) {
      out += rest.slice(start);
      rest = '';
      break;
    }
    rest = rest.slice(end + run);
  }
  return out + rest;
}

/** Applies `fn` to the parts of a line outside `code` spans, by maskInlineCode's rules. */
function mapOutsideInlineCode(line, fn) {
  let out = '';
  let rest = line;
  for (;;) {
    const start = rest.indexOf('`');
    if (start < 0) break;
    const run = runLength(rest.slice(start), '`');
    const end = rest.indexOf('`'.repeat(run), start + run);
    if (end < 0) break;
    out += fn(rest.slice(0, start)) + rest.slice(start, end + run);
    rest = rest.slice(end + run);
  }
  return out + fn(rest);
}

/**
 * Rewrites prose only: `fn` sees text outside fenced blocks and `code` spans,
 * line by line; code is returned untouched.
 */
export function mapProse(content, fn) {
  return splitFences(content)
    .flatMap((segment) =>
      segment.kind === 'fence' ? segment.lines : segment.lines.map((line) => mapOutsideInlineCode(line, fn)),
    )
    .join('\n');
}

// A run of tags that ends a line: `… text. #site/blog #drafta`.
const TRAILING_TAGS = /(^|[ \t])((?:#[^\s#`]+[ \t]*)+)$/u;

function withoutTrailingTags(line, wanted) {
  const match = TRAILING_TAGS.exec(line);
  if (!match) return line;
  const run = match[2].trim().split(/[ \t]+/);
  const kept = run.filter((tag) => !wanted.has(tag.slice(1).toLowerCase()));
  if (kept.length === run.length) return line;
  const head = line.slice(0, match.index).trimEnd();
  return [head, ...kept].filter(Boolean).join(' ');
}

/**
 * Removes the given full-path tags (e.g. `site/blog`) where they trail a line
 * of prose — they are publishing switches, not text for readers. A tag in the
 * middle of a sentence stays: cutting it would break the sentence.
 */
export function removeTags(content, tags) {
  const wanted = new Set(tags.map((tag) => tag.toLowerCase()));
  return splitFences(content)
    .flatMap((segment) =>
      segment.kind === 'fence' ? segment.lines : segment.lines.map((line) => withoutTrailingTags(line, wanted)),
    )
    .join('\n');
}

function masked(content) {
  return splitFences(content)
    .flatMap((segment) => (segment.kind === 'fence' ? segment.lines.map(() => '') : segment.lines.map(maskInlineCode)))
    .join('\n');
}

/**
 * `#single` → simpleTags ["single"]; `#A/B/C` → pathTags [{path: ["a","b"], leaf: "c"}].
 * Lowercased and de-duplicated by raw text, in order of appearance.
 */
export function parseTags(content) {
  const simpleTags = [];
  const pathTags = [];
  const seen = new Set();
  for (const match of masked(content).matchAll(TAG_PATTERN)) {
    const raw = match[1].toLowerCase();
    if (seen.has(raw)) continue;
    seen.add(raw);
    const parts = raw.split('/').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) pathTags.push({ path: parts.slice(0, -1), leaf: parts.at(-1) });
    else simpleTags.push(raw);
  }
  return { simpleTags, pathTags };
}

/**
 * Every tag of a note by its full path (`site/blog`, not `blog`): body tags
 * plus front matter `extraTags`, lowercased, unique, sorted.
 */
export function fullTags(content, extraTags = []) {
  const { simpleTags, pathTags } = parseTags(content);
  const all = [
    ...simpleTags,
    ...pathTags.map(({ path, leaf }) => [...path, leaf].join('/')),
    ...extraTags.map((tag) => tag.toLowerCase()),
  ];
  return [...new Set(all)].sort();
}
