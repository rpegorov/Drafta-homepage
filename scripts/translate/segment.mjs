// Markdown → text the model may touch + the fragments it must never see
// (PLAN v2 §11.9 rule 3). Every protected fragment is replaced by a ⟦n⟧
// placeholder; restore() puts the original bytes back.
//
// Protected: fenced blocks (``` and ~~~, any info string — mermaid, site),
// $$…$$ and $…$ math, inline code, HTML tags and comments, [[wiki links]],
// link/image brackets and destinations (the link text and alt are translated),
// reference definitions, bare URLs and attachment://, callout markers
// `[!NOTE]`, footnote markers, table delimiter rows.

const PLACEHOLDER = /⟦(\d+)⟧/g;
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})/;

/** Inline patterns, applied in this order to the text outside fenced blocks. */
const INLINE_RULES = [
  { pattern: /<!--[\s\S]*?-->/g },
  { pattern: /(`+)(?!`)[^\n]*?(?<!`)\1(?!`)/g },
  { pattern: /\$\$[\s\S]+?\$\$/g },
  { pattern: /\$(?![\s$])[^$\n]*?(?<![\s\\])\$/g },
  { pattern: /<\/?[A-Za-z][^<>\n]*>|<https?:\/\/[^<>\s]+>/g },
  { pattern: /!?\[\[[^\]\n]+\]\]/g },
  { pattern: /\[![A-Za-z]+\][+-]?/g },
  { pattern: /\[\^[^\]\n]+\]:?/g },
  { pattern: /^ {0,3}\[[^\]\n]+\]:[ \t]*\S.*$/gm },
  { pattern: /^[ \t]*\|?(?:[ \t]*:?-+:?[ \t]*\|)+(?:[ \t]*:?-+:?)?[ \t]*$/gm },
];

// `![alt](dest)` and `[text](dest)`: the opening bracket and `](dest)` are
// protected separately so the alt/text between them stays translatable.
const LINK = /(!?\[)((?:[^[\]\n]|\[[^[\]\n]*\])*)(\]\((?:[^()\n]|\([^()\n]*\))*\)|\]\[[^\]\n]*\])/g;
const BARE_URL = /(?:https?|attachment):\/\/[^\s<>()[\]⟦]*[^\s<>()[\]⟦.,;:!?'"]/g;

function placeholderStore() {
  const parts = [];
  const hide = (fragment) => {
    parts.push(expand(fragment, parts));
    return `⟦${parts.length - 1}⟧`;
  };
  return { parts, hide };
}

function expand(text, parts) {
  return text.replace(PLACEHOLDER, (whole, n) => parts[Number(n)] ?? whole);
}

/** Replaces every fenced block (fences included) with a placeholder, line by line. */
function hideFences(markdown, hide) {
  const lines = markdown.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = lines[i].match(FENCE_OPEN);
    if (!open) {
      out.push(lines[i]);
      continue;
    }
    const marker = open[2];
    const close = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}[ \\t]*$`);
    let end = i + 1;
    while (end < lines.length && !close.test(lines[end])) end += 1;
    const last = Math.min(end, lines.length - 1);
    out.push(hide(lines.slice(i, last + 1).join('\n')));
    i = last;
  }
  return out.join('\n');
}

function hideLinks(text, hide) {
  return text.replace(LINK, (whole, open, inner, dest) => `${hide(open)}${inner}${hide(dest)}`);
}

/**
 * @param {string} markdown body without front matter
 * @returns {{text: string, parts: string[]}} text — what the model receives
 */
export function segment(markdown) {
  const { parts, hide } = placeholderStore();
  let text = hideFences(markdown, hide);
  for (const { pattern } of INLINE_RULES) text = text.replace(pattern, (fragment) => hide(fragment));
  // Images first: a linked image `[![alt](img)](url)` nests inside a link.
  text = hideLinks(hideLinks(text, hide), hide);
  text = text.replace(BARE_URL, (url) => hide(url));
  return { text, parts };
}

/** Puts every protected fragment back in place of its placeholder. */
export function restore(text, { parts }) {
  return expand(text, parts);
}

/** The placeholder numbers in `text`, in order of appearance. */
export function placeholdersIn(text) {
  return [...text.matchAll(PLACEHOLDER)].map((match) => Number(match[1]));
}
