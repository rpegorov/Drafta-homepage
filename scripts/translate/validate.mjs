// Checks on what the model returned (PLAN v2 §11.9 rule 4). Pure: strings in,
// the list of violated rules out — an empty list means the output is accepted.
import { placeholdersIn } from './segment.mjs';

const MIN_LENGTH_RATIO = 0.5;
const MAX_LENGTH_RATIO = 2.5;
// Titles and one-word chunks legitimately change length by more than the
// ratio allows ("Да" → "Yes"); the ratio only judges text longer than this.
const MIN_LENGTH_FOR_RATIO = 40;

const HEADING = /^ {0,3}(#{1,6})\s/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/;
const PREAMBLE = /^\s*(?:here is|here's|here are|sure[,!])/i;
const RAW_FENCE = /```/;
const HTML_TAG = /<\/?([a-zA-Z][\w-]*)[^<>]*>/g;

/** Lowercased names of the HTML tags in a text — what a model tends to add (<br>, <p>) around Markdown. */
function htmlTagNames(text) {
  return new Set([...text.matchAll(HTML_TAG)].map((match) => match[1].toLowerCase()));
}

/** Tags in the output that the source never used: markup invented by the model. */
function addedHtmlTags(source, output) {
  const known = htmlTagNames(source);
  return [...htmlTagNames(output)].filter((name) => !known.has(name));
}

function headingLevels(text) {
  const counts = {};
  for (const line of text.split('\n')) {
    const match = line.match(HEADING);
    if (match) counts[match[1].length] = (counts[match[1].length] ?? 0) + 1;
  }
  return JSON.stringify(counts);
}

function listItems(text) {
  return text.split('\n').filter((line) => LIST_ITEM.test(line)).length;
}

function sameSequence(a, b) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * @param {string} source the chunk sent (with placeholders)
 * @param {string} output the model's answer
 * @returns {string[]} violated rules, phrased for the retry prompt
 */
export function validateChunk(source, output) {
  if (!output.trim()) return ['the output is empty'];
  const violations = [];
  if (!sameSequence(placeholdersIn(source), placeholdersIn(output))) {
    violations.push('every ⟦n⟧ placeholder must appear exactly once and in the original order');
  }
  if (headingLevels(source) !== headingLevels(output)) violations.push('the number and levels of headings must stay the same');
  if (listItems(source) !== listItems(output)) violations.push('the number of list items must stay the same');
  if (RAW_FENCE.test(output)) violations.push('do not add ``` code fences');
  const added = addedHtmlTags(source, output);
  if (added.length > 0) violations.push(`do not add HTML tags (${added.map((name) => `<${name}>`).join(', ')}) — keep the Markdown as it is`);
  if (source.length >= MIN_LENGTH_FOR_RATIO) {
    const ratio = output.length / source.length;
    if (ratio < MIN_LENGTH_RATIO || ratio > MAX_LENGTH_RATIO) violations.push('the translation must be a full translation, no longer or shorter than needed');
  }
  if (PREAMBLE.test(output)) violations.push('output only the translation, without an introduction');
  return violations;
}

const STRUCTURE_COUNTERS = {
  'fenced blocks': /^ {0,3}(?:`{3,}|~{3,})/gm,
  links: /\]\(/g,
  images: /!\[/g,
  'attachment links': /attachment:\/\//g,
};

/**
 * Whole-document check after the chunks are restored: a translation that lost
 * a fenced block, link, image or attachment is dropped entirely.
 * @returns {string[]} what differs, empty when the structure survived
 */
export function compareStructure(source, translated) {
  return Object.entries(STRUCTURE_COUNTERS)
    .filter(([, pattern]) => (source.match(pattern) ?? []).length !== (translated.match(pattern) ?? []).length)
    .map(([name]) => `${name} count changed`);
}
