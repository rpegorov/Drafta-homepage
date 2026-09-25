/* /rss.xml — English blog feed. */
import type { APIRoute } from 'astro';
import { feed } from '../components/blog/rss';

export const GET: APIRoute = ({ site }) => feed('en', site);
