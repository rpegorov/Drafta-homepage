/* t(lang, key) — the one way pages, components and scripts read a UI string.
   Any language other than 'ru' reads English, as the old scripts did. */

import { en, type MessageKey, type Messages } from './en';
import { ru } from './ru';
import type { Lang } from '../lib/types';

const DICTIONARIES: Record<Lang, Messages> = { en, ru };

/** Normalises anything to a supported language: 'ru' stays, everything else is 'en'. */
export function normalizeLang(lang: unknown): Lang {
  return lang === 'ru' ? 'ru' : 'en';
}

export function t<K extends MessageKey>(lang: Lang | string | null | undefined, key: K): Messages[K] {
  return DICTIONARIES[normalizeLang(lang)][key];
}

export type { Lang, MessageKey, Messages };
