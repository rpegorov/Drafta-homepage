import type { Lang } from '../../../lib/types';
import { en } from './en';
import { ru } from './ru';
import type { LandingCopy } from './types';

const COPY: Record<Lang, LandingCopy> = { en, ru };

export function landingCopy(lang: Lang): LandingCopy {
  return COPY[lang];
}

export type { LandingCopy };
