// state.json next to the clone (PLAN v2 §11.1 п. 4): the only memory that
// survives between launchd runs — every run is a fresh process.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const EMPTY_STATE = Object.freeze({ lastNotifiedReason: null, lastNotifiedAt: null, announcedProblems: [] });

/**
 * A missing file is an empty state. A corrupt one is too — it must not stop
 * publishing, the worst case is one repeated notification — but the caller
 * gets the reason to log.
 * @returns {{state: object, warning?: string}}
 */
export function readState(file) {
  if (!existsSync(file)) return { state: { ...EMPTY_STATE } };
  try {
    return { state: { ...EMPTY_STATE, ...JSON.parse(readFileSync(file, 'utf8')) } };
  } catch (error) {
    return { state: { ...EMPTY_STATE }, warning: `state.json unreadable, starting empty: ${error.message}` };
  }
}

export function writeState(file, state) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temp, file);
}

/** Whether a throttled notification for `reason` may go out now. */
export function mayNotify(state, reason, at, intervalMs) {
  if (state.lastNotifiedReason !== reason || !state.lastNotifiedAt) return true;
  return at.getTime() - Date.parse(state.lastNotifiedAt) >= intervalMs;
}

export function markNotified(state, reason, at) {
  return { ...state, lastNotifiedReason: reason, lastNotifiedAt: at.toISOString() };
}

// ── Translations (PLAN v2 §11.9 rules 5–6) ─────────────────────────────────
// state.translations = {pending: {slug: {reason, attempts, nextAfter, sourceHash,
// title, disabled?}}, day: {date: 'YYYY-MM-DD', chars}}.

const HOUR_MS = 60 * 60_000;
export const TRANSLATION_BACKOFF_MS = Object.freeze([1 * HOUR_MS, 4 * HOUR_MS, 24 * HOUR_MS]);
export const TRANSLATION_DISABLE_AFTER = 3;
// Not failures of a note: the run held it back, ran out of budget or time.
const NOT_FAILURES = new Set(['held', 'quota', 'timeout']);
// Failures that come from the note's own text: retrying the same text is futile,
// so after TRANSLATION_DISABLE_AFTER of them the note waits for an edit. Key,
// network and provider failures keep retrying on the backoff instead — fixing
// the key must bring every translation back without touching the notes.
const TEXT_FAILURES = new Set(['invalid-output', 'error']);

function translations(state) {
  return { pending: { ...(state.translations?.pending ?? {}) }, day: state.translations?.day ?? null };
}

const isoDay = (at) => at.toISOString().slice(0, 10);

/** `slug:sourceHash` of every translation the exporter must not attempt now. */
export function translationHold(state, at) {
  return Object.entries(translations(state).pending)
    .filter(([, entry]) => entry.disabled || Date.parse(entry.nextAfter) > at.getTime())
    .map(([slug, entry]) => `${slug}:${entry.sourceHash}`)
    .join(',');
}

export function translationCharsToday(state, at) {
  const { day } = translations(state);
  return day?.date === isoDay(at) ? day.chars : 0;
}

export function addTranslationChars(state, chars, at) {
  const next = translations(state);
  next.day = { date: isoDay(at), chars: translationCharsToday(state, at) + chars };
  return { ...state, translations: next };
}

/**
 * Folds the exporter's translated/translationDeferred into the pending map.
 * @returns {{state: object, events: {kind: 'deferred'|'disabled', slug: string, title?: string,
 *   reason: string, retryInMs?: number}[]}}
 */
export function recordTranslations(state, result, at) {
  const next = translations(state);
  const events = [];
  for (const done of result.translated ?? []) delete next.pending[done.slug];
  for (const deferred of result.translationDeferred ?? []) {
    if (NOT_FAILURES.has(deferred.reason)) continue;
    const previous = next.pending[deferred.slug];
    const sameText = previous && previous.sourceHash === (deferred.sourceHash ?? null);
    const attempts = (sameText ? previous.attempts : 0) + 1;
    const disabled = TEXT_FAILURES.has(deferred.reason) && attempts >= TRANSLATION_DISABLE_AFTER;
    const retryInMs = TRANSLATION_BACKOFF_MS[Math.min(attempts, TRANSLATION_BACKOFF_MS.length) - 1];
    next.pending[deferred.slug] = {
      reason: deferred.reason,
      attempts,
      nextAfter: new Date(at.getTime() + retryInMs).toISOString(),
      sourceHash: deferred.sourceHash ?? null,
      title: deferred.title ?? null,
      ...(disabled ? { disabled: true } : {}),
    };
    const base = { slug: deferred.slug, title: deferred.title, reason: deferred.reason };
    events.push(disabled ? { kind: 'disabled', ...base } : { kind: 'deferred', ...base, retryInMs });
  }
  return { state: { ...state, translations: next }, events };
}
