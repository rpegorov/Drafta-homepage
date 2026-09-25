// publish.config.json at the site repository's root: what the exporter needs
// to know about THIS site. Owner's decision 2026-09-25: the publishing tag
// namespace is the site's, not the exporter's — the same library feeds several
// sites, each selected by its own `<namespace>/blog` and `<namespace>/docs`.
// There is no default namespace: a missing file is a configuration error, not
// a site that silently publishes under some other site's tags.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PUBLISH_CONFIG_FILE = 'publish.config.json';
// One tag path segment, as the app lowercases it: `drafta`, not `Drafta` or `drafta/x`.
const TAG_SEGMENT = /^[a-z0-9_]+$/;

export class PublishConfigError extends Error {}

/**
 * @param {string} siteDir the site repository (`--site`)
 * @returns {{tagNamespace: string}}
 * @throws {PublishConfigError} when the file is missing, unreadable or names no usable namespace
 */
export function readPublishConfig(siteDir) {
  const file = join(siteDir, PUBLISH_CONFIG_FILE);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    const why = error.code === 'ENOENT' ? 'is missing' : `is unreadable (${error.message})`;
    throw new PublishConfigError(`${file} ${why} — the site must say which tags publish to it, e.g. {"tagNamespace": "drafta"}`);
  }
  const namespace = parsed?.tagNamespace;
  if (typeof namespace !== 'string' || !TAG_SEGMENT.test(namespace)) {
    throw new PublishConfigError(`${file}: "tagNamespace" must be one lowercase tag segment (letters, digits, _), got ${JSON.stringify(namespace)}`);
  }
  return { tagNamespace: namespace };
}
