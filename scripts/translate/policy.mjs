// The rules of the translation step (PLAN v2 §11.9 rules 1–6), free of IO:
// cache by source hash, the publisher's hold list, the per-run character
// budget, and which failure stops the rest of the run. Translating, building
// and publishing a document are injected; the CLI (scripts/import-from-drafta.mjs)
// owns the files, git and the provider.
//
// Two phases: every model call of the run first, then every page is built at
// once and published one by one — a translated page may link another
// translation of the same run only when that one already exists.
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

/** Phase 1: which jobs get a model call, and its result. */
async function translatePhase(jobs, { budget, hold }, translate, out) {
  const made = [];
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
    try {
      made.push({ job, base, hash, chars, defer, ...(await translate(job)) });
    } catch (error) {
      const deferral = asDeferral(error);
      if (RUN_WIDE_DEFERRALS.has(deferral.reason)) stopper = deferral;
      defer(deferral.reason, deferral.detail);
    }
  }
  return made;
}

/**
 * Runs the translation jobs of one committed run and never throws — the
 * originals are already committed.
 * @param {{job: object, hash: string, chars: number}[]} jobs plan jobs
 *   ({slug, title, from, to, existing?}) with the source's hash and length
 * @param {{budget: number, hold: Set<string>, provider: string}} limits
 * @param {{translate: (job: object) => Promise<{done: object, usage: object, model: string}>,
 *   build: (items: {job: object, done: object}[]) => ({page: object} | {error: string})[],
 *   publish: (job: object, page: object) => Promise<string|undefined>}} io
 *   translate — the model call (throws TranslationDeferred on a text or provider problem);
 *   build — the pages of every translation made, aligned with `items`; an error is a text problem;
 *   publish — writes and commits one page, resolving the commit sha
 * @returns {Promise<{translated: object[], deferred: object[], chars: number, sha?: string, errors: object[]}>}
 */
export async function runTranslations(jobs, { budget, hold, provider }, { translate, build, publish }) {
  const out = { translated: [], deferred: [], chars: 0, sha: undefined, errors: [] };
  const made = await translatePhase(jobs, { budget, hold }, translate, out);
  const built = made.length > 0 ? await build(made.map(({ job, done }) => ({ job, done }))) : [];

  for (const [i, item] of made.entries()) {
    const result = built[i];
    if (!result?.page) {
      item.defer(DEFER.invalid, result?.error ?? 'no page built');
      continue;
    }
    try {
      out.sha = (await publish(item.job, result.page)) ?? out.sha;
    } catch (error) {
      out.errors.push({ title: 'git', message: (error.stderr || error.message || String(error)).trim() });
      break;
    }
    out.translated.push({ ...item.base, cached: false, url: result.page.url, path: result.page.path, provider, model: item.model, usage: item.usage, chars: item.chars });
  }
  return out;
}
