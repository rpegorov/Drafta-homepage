// Which notes go to the site (PLAN v2 §11.1 п. 8–9, §11.4 ЗАДАЧА-2.2).
// Publishing needs four independent signals — status Completed, the site's
// section tag by full path (`<namespace>/blog` or `<namespace>/docs`, the
// namespace from publish.config.json), a site block with slug + description,
// not in the trash — so a stray tag or a stray Completed alone publishes nothing.
import { extractSiteBlock } from './site-block.mjs';
import { fullTags } from './tags.mjs';

const COMPLETED = 'completed';
const SECTIONS = ['blog', 'docs'];

/** `{blog: '<ns>/blog', docs: '<ns>/docs'}` — the exact tags that publish to this site. */
export function sectionTagsFor(tagNamespace) {
  return Object.fromEntries(SECTIONS.map((section) => [section, `${tagNamespace}/${section}`]));
}

/** Skip reasons; the tag-related ones name the site's own tags. */
export function skipReasons(sectionTags) {
  const named = Object.values(sectionTags);
  return {
    sealed: 'sealed',
    template: 'template',
    trashed: 'trashed',
    notCompleted: 'not completed',
    noSiteTag: `no ${named.join(' or ')} tag`,
    bothSections: `both ${named.join(' and ')}`,
    noSiteBlock: 'no site block',
    publishFalse: 'publish: false',
    noSlug: 'no slug in site block',
    noDescription: 'no description in site block',
  };
}

function sectionsOf(tags, sectionTags) {
  return Object.entries(sectionTags)
    .filter(([, tag]) => tags.includes(tag))
    .map(([section]) => section);
}

/**
 * Applies the selection rule to one decoded note (see notes.mjs `decodeNote`).
 * @param {object} note
 * @param {{blog: string, docs: string}} sectionTags from `sectionTagsFor`
 * @returns
 *   {verdict: 'publish', section, site, body, tags, warnings} — body without the site block;
 *   {verdict: 'skip', reason} — the note does not (or no longer) belong on the site;
 *   {verdict: 'error', message} — it wants to be published but its site block is broken.
 */
export function selectNote(note, sectionTags) {
  const SKIP = skipReasons(sectionTags);
  if (note.isTemplate) return skip(SKIP.template);
  if (note.trashed) return skip(SKIP.trashed);
  if (note.status !== COMPLETED) return skip(SKIP.notCompleted);

  const tags = fullTags(note.body, note.extraTags);
  const sections = sectionsOf(tags, sectionTags);
  if (sections.length === 0) return skip(SKIP.noSiteTag);
  if (sections.length > 1) return skip(SKIP.bothSections);

  const block = extractSiteBlock(note.body);
  if (!block.found) return skip(SKIP.noSiteBlock);
  // The take-down switch is judged before the block's other problems: a page
  // the owner switched off must come down even if the rest of the block is broken.
  if (!block.fields.publish) return skip(SKIP.publishFalse);
  if (block.problems.length > 0) {
    return { verdict: 'error', message: `site block: ${block.problems.join('; ')}` };
  }
  if (!block.fields.slug) return skip(SKIP.noSlug);
  if (!block.fields.description) return skip(SKIP.noDescription);

  return {
    verdict: 'publish',
    section: sections[0],
    site: block.fields,
    body: block.body,
    tags: publicTags(note.body, sectionTags),
    warnings: block.warnings,
  };
}

/**
 * The tags a reader sees on the page and in RSS: only those written in the
 * note's text, minus the site's own section tags (publishing switches, not
 * content). Front matter `extraTags` are the app's hidden bookkeeping and stay out.
 */
function publicTags(body, sectionTags) {
  const switches = new Set(Object.values(sectionTags));
  return fullTags(body).filter((tag) => !switches.has(tag));
}

function skip(reason) {
  return { verdict: 'skip', reason };
}
