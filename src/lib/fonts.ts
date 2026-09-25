/* Fonts preloaded by Base.astro, per page language.
   The brand ships one Cyrillic-complete woff2 per family (public/fonts/, declared
   in tokens.css), so English and Russian pages preload the same two files: the
   body face and the display face used above the fold. Mono loads on demand. */

import type { Lang } from './types';

const ABOVE_THE_FOLD = ['/fonts/GolosText.woff2', '/fonts/Lora.woff2'];

const PRELOADS: Record<Lang, string[]> = {
  en: ABOVE_THE_FOLD,
  ru: ABOVE_THE_FOLD,
};

export function fontPreloads(lang: Lang): string[] {
  return PRELOADS[lang];
}
