/* Language rules shared by the build (Base, Header) and the browser (scripts/lang.ts).
   English lives at the root, Russian under /ru/. Pure functions, no DOM. */

import type { Lang } from './types';

const RU_PREFIX = /^\/ru(?=\/|$)/;

/** True when the path belongs to the Russian twin. */
export function isRuPath(pathname: string): boolean {
  return /^\/ru(\/|$)/.test(pathname);
}

/** The language a path belongs to. */
export function langOfPath(pathname: string): Lang {
  return isRuPath(pathname) ? 'ru' : 'en';
}

/** "/login/" -> "/ru/login/" and "/ru/login/" -> "/login/"; "/ru" -> "/". */
export function twinPath(pathname: string, isRu: boolean = isRuPath(pathname)): string {
  if (isRu) {
    const stripped = pathname.replace(RU_PREFIX, '');
    return stripped === '' ? '/' : stripped;
  }
  return '/ru' + pathname;
}

/** The English and Russian paths of one page, given either of them. */
export function localePaths(pathname: string): Record<Lang, string> {
  return isRuPath(pathname)
    ? { en: twinPath(pathname, true), ru: pathname }
    : { en: pathname, ru: twinPath(pathname, false) };
}

/** Prefixes an English site path for the given language: ("/login/", "ru") -> "/ru/login/". */
export function localePath(enPath: string, lang: Lang): string {
  return lang === 'ru' ? twinPath(enPath, false) : enPath;
}

/* A same-site ?next= (the login page's return address) follows the visitor to
   the Russian twin too, so signing in does not land them on an English page. */
export function ruSearch(search: string | null | undefined): string {
  return String(search || '').replace(/([?&]next=)(%2F|\/)(?!ru(%2F|\/))/i, '$1$2ru$2');
}
