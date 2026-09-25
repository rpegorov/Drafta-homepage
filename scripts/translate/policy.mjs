// The rules of the translation step (PLAN v2 §11.9 rules 1–6), free of IO:
// cache by source hash, the publisher's hold list, the per-run character
// budget, and which failure stops the rest of the run. Translating and
// publishing a document are injected; the CLI (scripts/import-from-drafta.mjs)
// owns the files, git and the provider.
import { DEFER, TranslationDeferred } from './translate.mjs';

export const DEFAULT_MAX_CHARS_PER_RUN = 60_000;
export const HELD = 'held';
export const UNEXPECTED = 'error';
// After one of these, every later request of the run would fail the same way.
export const RUN_WIDE_DEFERRALS = new Set([DEFER.noKey, DEFER.offline, DEFER.auth, DEFER.timeout]);

/** `slug:sourceHash,…` from the publisher → the set of held translations. */
export function parseHold(value = '') {
  return new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function asDeferral(error) {
  return error instanceof TranslationDeferred ? error : new TranslationDeferred(UNEXPECTED, error?.message ?? String(error));
}

/**
 * Runs the translation jobs of one committed run, one document at a time, and
 * never throws — the originals are already committed.
 * @param {{job: object, hash: string, chars: number}[]} jobs plan jobs
 *   ({slug, title, from, to, existing?}) with the source's hash and length
 * @param {{budget: number, hold: Set<string>, provider: string}} limits
 * @param {{translate: (job: object) => Promise<{page: object, usage: object, model: string}>,
 *   publish: (job: object, page: object) => Promise<string|undefined>}} io
 *   translate — the translated page (throws TranslationDeferred on a text or provider problem);
 *   publish — writes and commits it, resolving the commit sha
 * @returns {Promise<{translated: object[], deferred: object[], chars: number, sha?: string, errors: object[]}>}
 */
export async function runTranslations(jobs, { budget, hold, provider }, { translate, publish }) {
  const out = { translated: [], deferred: [], chars: 0, sha: undefined, errors: [] };
  let left = budget;
  let stopper = null;

  for (const { job, hash, chars } of jobs) {
    const base = { slug: job.slug, title: job.title, from: job.from, to: job.to };
    const defer = (reason, detail) => out.deferred.push({ ...base, reason, ...(detail ? { detail } : {}), sourceHash: hash });
    if (job.existing?.translation?.sourceHash === hash) {
      out.translated.push({ ...base, cached: true });
      continue;
    }
    if (hold.has(`${job.slug}:${hash}`)) {
      defer(HELD);
      continue;
    }
    if (stopper) {
      defer(stopper.reason, stopper.detail);
      continue;
    }
    if (chars > left) {
      defer(DEFER.quota, `needs ${chars} characters, ${left} left this run`);
      continue;
    }

    left -= chars;
    out.chars += chars;
    let result;
    try {
      result = await translate(job);
    } catch (error) {
      const deferral = asDeferral(error);
      if (RUN_WIDE_DEFERRALS.has(deferral.reason)) stopper = deferral;
      defer(deferral.reason, deferral.detail);
      continue;
    }
    try {
      out.sha = (await publish(job, result.page)) ?? out.sha;
    } catch (error) {
      out.errors.push({ title: 'git', message: (error.stderr || error.message || String(error)).trim() });
      break;
    }
    out.translated.push({ ...base, cached: false, url: result.page.url, path: result.page.path, provider, model: result.model, usage: result.usage, chars });
  }
  return out;
}
