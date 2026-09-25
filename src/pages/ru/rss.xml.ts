/* /ru/rss.xml — Russian blog feed. */
import type { APIRoute } from 'astro';
import { feed } from '../../components/blog/rss';

export const GET: APIRoute = ({ site }) => feed('ru', site);
