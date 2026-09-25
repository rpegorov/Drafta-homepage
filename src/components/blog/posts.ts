/* Blog rules shared by the list, the post page, RSS and OG: which posts a
   language shows, in what order, where each one lives and which twin it has.
   Pages and components only render what these functions return. */

import { getCollection, type CollectionEntry } from 'astro:content';
import { localePath } from '../../lib/lang';
import type { Lang } from '../../lib/types';

export type Post = CollectionEntry<'blog'>;

const INTL_LOCALE: Record<Lang, string> = { en: 'en-GB', ru: 'ru-RU' };

/**
 * Newest day first. Within one day the posts run in the order they were
 * written (`created` ascending — a series reads in order; a release
 * announcement written first comes first); posts without `created` follow
 * those with it, then the title keeps the order stable.
 */
export function byNewest(a: Post, b: Post): number {
  return b.data.date.localeCompare(a.data.date) || byCreated(a, b) || a.data.title.localeCompare(b.data.title);
}

function byCreated(a: Post, b: Post): number {
  const ca = a.data.created;
  const cb = b.data.created;
  if (ca && cb) return ca.localeCompare(cb);
  if (ca || cb) return ca ? -1 : 1;
  return 0;
}

/** Every post of one language, newest first. */
export async function postsOf(lang: Lang): Promise<Post[]> {
  const posts = await getCollection('blog', (entry) => entry.data.lang === lang);
  return posts.sort(byNewest);
}

/** "/blog/" or "/ru/blog/". */
export function blogIndexPath(lang: Lang): string {
  return localePath('/blog/', lang);
}

/** "/blog/<slug>/" or "/ru/blog/<slug>/". */
export function postPath(lang: Lang, slug: string): string {
  return localePath(`/blog/${slug}/`, lang);
}

/** "/rss.xml" or "/ru/rss.xml". */
export function rssPath(lang: Lang): string {
  return lang === 'ru' ? '/ru/rss.xml' : '/rss.xml';
}

/** "/og/<lang>/<slug>.png". */
export function ogImagePath(lang: Lang, slug: string): string {
  return `/og/${lang}/${slug}.png`;
}

/** The same post in the other language, if it was published. */
export async function twinOf(post: Post): Promise<Post | undefined> {
  const other: Lang = post.data.lang === 'ru' ? 'en' : 'ru';
  const [twin] = await getCollection(
    'blog',
    (entry) => entry.data.lang === other && entry.data.slug === post.data.slug,
  );
  return twin;
}

/** hreflang targets: the post's own language always, the twin only if it exists. */
export function alternatesOf(post: Post, twin: Post | undefined): Partial<Record<Lang, string>> {
  const alternates: Partial<Record<Lang, string>> = {
    [post.data.lang]: postPath(post.data.lang, post.data.slug),
  };
  if (twin) alternates[twin.data.lang] = postPath(twin.data.lang, twin.data.slug);
  return alternates;
}

/** A front-matter date ("YYYY-MM-DD") as a Date at UTC midnight. */
export function toDate(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00Z`);
}

/** "25 September 2026" / "25 сентября 2026 г." — read in UTC, so the day never shifts. */
export function formatDay(isoDay: string, lang: Lang): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], { dateStyle: 'long', timeZone: 'UTC' }).format(toDate(isoDay));
}
