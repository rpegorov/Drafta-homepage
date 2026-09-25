/* The RSS feed of one language — shared by /rss.xml and /ru/rss.xml. */
import rss from '@astrojs/rss';
import { t } from '../../i18n';
import type { Lang } from '../../lib/types';
import { blogIndexPath, postPath, postsOf, toDate } from './posts';

export async function feed(lang: Lang, site: URL | undefined): Promise<Response> {
  if (!site) throw new Error('rss: `site` is not set in astro.config.mjs');
  const strings = t(lang, 'blog');
  const posts = await postsOf(lang);
  return rss({
    title: strings.rssTitle,
    description: strings.rssDescription,
    site: new URL(blogIndexPath(lang), site).href,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: toDate(post.data.date),
      link: new URL(postPath(lang, post.data.slug), site).href,
      categories: post.data.tags,
    })),
    customData: `<language>${lang}</language>`,
  });
}
