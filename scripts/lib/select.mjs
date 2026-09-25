// Which notes go to the site (PLAN v2 §11.1 п. 8–9, §11.4 ЗАДАЧА-2.2).
// Publishing needs four independent signals — status Completed, a site/* tag
// by full path, a site block with slug + description, not in the trash — so a
// stray `#site/blog` or a stray Completed alone publishes nothing.
import { extractSiteBlock } from './site-block.mjs';
import { fullTags } from './tags.mjs';

export const SECTION_TAGS = { blog: 'site/blog', docs: 'site/docs' };
const COMPLETED = 'completed';

export const SKIP = {
  sealed: 'sealed',
  template: 'template',
  trashed: 'trashed',
  notCompleted: 'not completed',
  noSiteTag: 'no site tag',
  bothSections: 'both site/blog and site/docs',
  noSiteBlock: 'no site block',
  publishFalse: 'publish: false',
  noSlug: 'no slug in site block',
  noDescription: 'no description in site block',
};

function sectionsOf(tags) {
  return Object.entries(SECTION_TAGS)
    .filter(([, tag]) => tags.includes(tag))
    .map(([section]) => section);
}

/**
 * Applies the selection rule to one decoded note (see notes.mjs `decodeNote`).
 * @returns
 *   {verdict: 'publish', section, site, body, tags, warnings} — body without the site block;
 *   {verdict: 'skip', reason} — the note does not (or no longer) belong on the site;
 *   {verdict: 'error', message} — it wants to be published but its site block is broken.
 */
export function selectNote(note) {
  if (note.isTemplate) return skip(SKIP.template);
  if (note.trashed) return skip(SKIP.trashed);
  if (note.status !== COMPLETED) return skip(SKIP.notCompleted);

  const tags = fullTags(note.body, note.extraTags);
  const sections = sectionsOf(tags);
  if (sections.length === 0) return skip(SKIP.noSiteTag);
  if (sections.length > 1) return skip(SKIP.bothSections);

  const block = extractSiteBlock(note.body);
  if (!block.found) return skip(SKIP.noSiteBlock);
  if (block.problems.length > 0) {
    return { verdict: 'error', message: `site block: ${block.problems.join('; ')}` };
  }
  if (!block.fields.publish) return skip(SKIP.publishFalse);
  if (!block.fields.slug) return skip(SKIP.noSlug);
  if (!block.fields.description) return skip(SKIP.noDescription);

  return {
    verdict: 'publish',
    section: sections[0],
    site: block.fields,
    body: block.body,
    tags: tags.filter((tag) => tag !== 'site' && !tag.startsWith('site/')),
    warnings: block.warnings,
  };
}

function skip(reason) {
  return { verdict: 'skip', reason };
}
