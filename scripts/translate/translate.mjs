// One document through the provider (PLAN v2 §11.9 rules 2–6): segment →
// chunks → one request at a time → validate (one retry that names the broken
// rule) → restore → whole-document structure check. Any failure throws
// TranslationDeferred: a partial translation never leaves this module.
// All IO is injected: {fetch, now, sleep, provider, model, key}.
import { createHash } from 'node:crypto';
import { chunkText, maxTokensFor, systemPrompt } from './prompt.mjs';
import { providerFor } from './providers.mjs';
import { restore, segment } from './segment.mjs';
import { compareStructure, validateChunk } from './validate.mjs';

export const DEFER = Object.freeze({
  noKey: 'no-key',
  offline: 'offline',
  auth: 'auth',
  rateLimit: 'rate-limit',
  provider: 'provider',
  invalid: 'invalid-output',
  quota: 'quota',
  timeout: 'timeout',
});

const ATTEMPTS_PER_CHUNK = 2;
const RATE_LIMIT_RETRIES = 2;
const RETRY_AFTER_CAP_MS = 60_000;
const RETRY_AFTER_DEFAULT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 60_000;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const MS_PER_SECOND = 1000;

export class TranslationDeferred extends Error {
  /** @param {string} reason one of DEFER @param {string} detail human-readable, never contains the key */
  constructor(reason, detail) {
    super(`${reason}: ${detail}`);
    this.reason = reason;
    this.detail = detail;
  }
}

/** sha256 of what the translation is made from (rule 2) — the cache key stored in the translated file. */
export function sourceHash({ title, description, body }) {
  return createHash('sha256').update(`${title}\n${description}\n${body}`).digest('hex');
}

/** Characters a document costs against the run and day limits. */
export function documentChars({ title, description, body }) {
  return title.length + description.length + body.length;
}

function retryAfterMs(response) {
  const seconds = Number(response.headers.get('retry-after'));
  const ms = Number.isFinite(seconds) && seconds > 0 ? seconds * MS_PER_SECOND : RETRY_AFTER_DEFAULT_MS;
  return Math.min(ms, RETRY_AFTER_CAP_MS);
}

function httpFailure(status) {
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) return new TranslationDeferred(DEFER.auth, `the provider rejected the key (HTTP ${status})`);
  if (status === HTTP_TOO_MANY_REQUESTS) return new TranslationDeferred(DEFER.rateLimit, 'rate limited (HTTP 429) after retries');
  return new TranslationDeferred(DEFER.provider, `HTTP ${status}`);
}

/**
 * @param {{fetch: Function, now: () => Date, sleep?: (ms: number) => Promise<void>,
 *   provider: string, model?: string, key?: string, deadline?: Date}} io
 *   deadline — no new request starts after it (the originals wait for this step)
 */
export function createTranslator({ fetch, now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), provider, model, key, deadline }) {
  const api = providerFor(provider);
  const usedModel = model || api?.defaultModel;
  const usage = { inputTokens: 0, outputTokens: 0, requests: 0 };

  async function post(request) {
    if (deadline && now().getTime() >= deadline.getTime()) {
      throw new TranslationDeferred(DEFER.timeout, 'the translation time of this run is used up');
    }
    try {
      return await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new TranslationDeferred(DEFER.offline, error?.cause?.code ?? error?.name ?? 'network error');
    }
  }

  async function ask(system, text) {
    const request = api.request({ key, model: usedModel, system, text, maxTokens: maxTokensFor(text) });
    for (let retry = 0; ; retry += 1) {
      usage.requests += 1;
      const response = await post(request);
      if (response.status === HTTP_TOO_MANY_REQUESTS && retry < RATE_LIMIT_RETRIES) {
        await sleep(retryAfterMs(response));
        continue;
      }
      if (!response.ok) throw httpFailure(response.status);
      let json;
      try {
        json = await response.json();
      } catch {
        throw new TranslationDeferred(DEFER.provider, 'the answer is not JSON');
      }
      const answer = api.answer(json);
      usage.inputTokens += answer.usage.inputTokens;
      usage.outputTokens += answer.usage.outputTokens;
      return answer;
    }
  }

  async function translateChunk(chunk, { from, to, singleLine }) {
    let violations = [];
    for (let attempt = 1; attempt <= ATTEMPTS_PER_CHUNK; attempt += 1) {
      const answer = await ask(systemPrompt(from, to, violations), chunk);
      const output = answer.text.trim();
      violations = validateChunk(chunk, output);
      if (answer.truncated) violations.push('the output was cut off; translate without adding anything');
      if (singleLine && output.includes('\n')) violations.push('the output must be a single line');
      if (violations.length === 0) return output;
    }
    throw new TranslationDeferred(DEFER.invalid, violations.join('; '));
  }

  async function translateMarkdown(markdown, options) {
    const seg = segment(markdown);
    let out = '';
    for (const { lead, chunk, trail } of chunkText(seg.text)) {
      out += lead + (chunk ? await translateChunk(chunk, options) : '') + trail;
    }
    return restore(out, seg);
  }

  /**
   * @param {{title: string, description: string, body: string}} doc
   * @param {{from: string, to: string}} direction
   * @returns {Promise<{title: string, description: string, body: string,
   *   translation: {sourceHash, sourceLang, provider, model, at}, usage: object}>}
   */
  async function translateDocument(doc, { from, to }) {
    if (!api) throw new TranslationDeferred(DEFER.noKey, `unknown AI provider "${provider ?? ''}"`);
    if (!key) throw new TranslationDeferred(DEFER.noKey, `no API key for ${provider}`);
    const title = await translateMarkdown(doc.title, { from, to, singleLine: true });
    const description = await translateMarkdown(doc.description, { from, to, singleLine: true });
    const body = await translateMarkdown(doc.body, { from, to, singleLine: false });
    const broken = compareStructure(doc.body, body);
    if (broken.length > 0) throw new TranslationDeferred(DEFER.invalid, broken.join('; '));
    return {
      title,
      description,
      body,
      translation: { sourceHash: sourceHash(doc), sourceLang: from, provider, model: usedModel, at: now().toISOString() },
      usage: { ...usage },
    };
  }

  return { translateDocument, usage, model: usedModel };
}
