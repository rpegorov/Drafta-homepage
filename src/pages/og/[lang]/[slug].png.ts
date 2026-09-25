/* /og/<lang>/<slug>.png — one social card per blog post, rendered at build time. */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOg } from '../../../lib/og';
import type { Post } from '../../../components/blog/posts';

export const getStaticPaths = (async () => {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { lang: post.data.lang, slug: post.data.slug },
    props: { post },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ post: Post }> = async ({ props }) => {
  const { title, lang, description } = props.post.data;
  const png = await renderOg({ title, lang, description });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
