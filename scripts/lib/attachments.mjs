// `attachment://<noteId>/<file>` links (PLAN v2 §4 п. 3, §11.0, §11.1 п. 12).
// Only files the text mentions are published; each is copied next to the page
// as `<slug>/<file>` and the link becomes `./<slug>/<file>`, so Astro optimises
// it and deleting the page deletes its folder. Path math only — no IO here.
import { dirname, join } from 'node:path';

const SCHEME = 'attachment://';
const REF = /attachment:\/\/([0-9A-Fa-f-]{36})\/([^\s)"'<>\]]+)/g;

function decodeName(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * A name is one path component: the text of a note is user-controlled, and
 * `attachment://<id>/..%2F..%2Fx` must not reach outside the note's folder
 * (the app refuses the same names in AttachmentPath).
 */
export function isSafeAttachmentName(name) {
  return name.length > 0 && name !== '.' && name !== '..' && !/[/\\\0]/.test(name);
}

/**
 * Every distinct attachment the body links to, in order of appearance.
 * @returns {{raw: string, noteId: string, name: string}[]} raw — the link text as written
 */
export function findAttachmentRefs(body) {
  const seen = new Map();
  for (const match of body.matchAll(REF)) {
    if (!seen.has(match[0])) {
      seen.set(match[0], { raw: match[0], noteId: match[1].toUpperCase(), name: decodeName(match[2]) });
    }
  }
  return [...seen.values()];
}

/** The site block's `cover` as an attachment ref: a bare file name means the note's own folder. */
export function coverRef(noteId, cover) {
  if (cover.startsWith(SCHEME)) return findAttachmentRefs(cover)[0] ?? null;
  return { raw: cover, noteId: noteId.toUpperCase(), name: cover };
}

/**
 * Attachment roots in the order the app used them (AttachmentStore, §11.0):
 * `<library>/attachments`, then the legacy `<library>/../attachments`
 * (for the default library: ~/Library/Application Support/Drafta/attachments).
 */
export function attachmentRoots(library) {
  return [join(library, 'attachments'), join(dirname(library), 'attachments')];
}

/** Where a ref's file may live, one candidate per root, in lookup order. */
export function candidatePaths(ref, roots) {
  return roots.map((root) => join(root, ref.noteId, ref.name));
}

/**
 * Replaces each ref's link text with `./<slug>/<name>`, keeping the name as it
 * was written (percent-encoding included) so the Markdown link stays valid.
 * Longer links go first: one link can be a prefix of another.
 */
export function rewriteAttachmentRefs(body, refs, slug) {
  const longestFirst = [...refs].sort((a, b) => b.raw.length - a.raw.length);
  let out = body;
  for (const ref of longestFirst) {
    const writtenName = ref.raw.slice(ref.raw.lastIndexOf('/') + 1);
    out = out.split(ref.raw).join(`./${slug}/${writtenName}`);
  }
  return out;
}

/** Names that two different refs would both write into `<slug>/`. */
export function clashingNames(refs) {
  const byName = new Map();
  for (const ref of refs) byName.set(ref.name, (byName.get(ref.name) ?? new Set()).add(ref.noteId));
  return [...byName].filter(([, ids]) => ids.size > 1).map(([name]) => name);
}
