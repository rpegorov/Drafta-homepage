// What the model is asked (PLAN v2 §11.9 rule 4): the system prompt, the
// chunks of the segmented text and the output budget per chunk.

export const MAX_CHUNK_CHARS = 6000;
// Rough upper bound for Cyrillic text: about two characters per token.
const CHARS_PER_TOKEN_ESTIMATE = 2;
const OUTPUT_TO_INPUT_TOKENS = 2;
// A title or a one-line chunk still needs room for a full answer.
const MIN_MAX_TOKENS = 256;

const LANGUAGE_NAMES = { en: 'English', ru: 'Russian' };

export function languageName(lang) {
  return LANGUAGE_NAMES[lang] ?? lang;
}

/**
 * @param {string} from source language code
 * @param {string} to target language code
 * @param {string[]} [violations] what the previous answer broke — sent on the retry
 */
export function systemPrompt(from, to, violations = []) {
  const base =
    `Translate the following Markdown from ${languageName(from)} to ${languageName(to)}. ` +
    'Keep every ⟦n⟧ placeholder exactly as is and in its place. ' +
    'Keep the number and levels of headings, the list structure and paragraph breaks. ' +
    'Do not add commentary. Output only the translated Markdown.';
  if (violations.length === 0) return base;
  return `${base}\nYour previous output violated: ${violations.join('; ')}. Fix exactly that.`;
}

export function maxTokensFor(chunk) {
  const estimate = Math.ceil(chunk.length / CHARS_PER_TOKEN_ESTIMATE);
  return Math.max(MIN_MAX_TOKENS, estimate * OUTPUT_TO_INPUT_TOKENS);
}

/**
 * Splits text at paragraph boundaries (blank lines; a heading starts its own
 * paragraph) into pieces of at most `maxChars`, a single longer paragraph
 * staying whole. Joining `pieces` restores the text exactly: every piece is
 * {lead, chunk, trail} with the whitespace kept out of what the model sees.
 */
export function chunkText(text, maxChars = MAX_CHUNK_CHARS) {
  const blocks = text.split(/(\n{2,})/);
  const groups = [];
  let current = '';
  for (let i = 0; i < blocks.length; i += 2) {
    const block = blocks[i] + (blocks[i + 1] ?? '');
    if (current && current.length + block.length > maxChars) {
      groups.push(current);
      current = '';
    }
    current += block;
  }
  if (current) groups.push(current);
  return groups.map(splitWhitespace);
}

function splitWhitespace(group) {
  const lead = group.match(/^\s*/)[0];
  const trail = group.slice(lead.length).match(/\s*$/)[0];
  return { lead, chunk: group.slice(lead.length, group.length - trail.length), trail };
}
