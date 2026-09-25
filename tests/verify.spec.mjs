// Email confirmation spends a single-use token. lang.ts sends a Russian
// browser from /verify/ to /ru/verify/ on the same first load, so the English
// load must not post the token the Russian load is about to post.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, openPage, resetScripts, runScript, stubFetch } from './helpers/browser.mjs';

const OWNER = 'review wave 1, item 4';
const HTML = `<!doctype html><html lang="en"><body>
  <div data-state="checking"></div><div data-state="incomplete" hidden></div>
  <div data-state="confirmed" hidden></div><div data-state="already" hidden></div>
  <div data-state="invalid" hidden><p data-invalid-reason></p></div>
  <div data-state="error" hidden></div><button data-retry></button>
</body></html>`;

let page;
afterEach(() => { page?.close(); page = undefined; });

async function openVerify(languages) {
  resetScripts();
  const fetch = stubFetch({ '/v1/auth/verify': () => json(200, { status: 'verified' }) });
  page = await openPage({ url: 'https://drafta.org/verify/?token=x', html: HTML, languages, fetch });
  await runScript('src/scripts/lang.ts', OWNER);
  await runScript('src/scripts/pages/verify.ts', OWNER);
  return fetch;
}

describe('verify spends the token once', () => {
  it('[-] a Russian browser with no stored choice is redirected to /ru/verify/ and posts nothing', async () => {
    const fetch = await openVerify(['ru-RU', 'ru']);
    await new Promise((done) => setTimeout(done, 50));
    expect(fetch).not.toHaveBeenCalled();
    expect(page.navigations.map((n) => n.url)).toEqual(['https://drafta.org/ru/verify/?token=x']);
  });

  it('[+] an English browser posts the token exactly once and stays on the page', async () => {
    const fetch = await openVerify(['en-US', 'en']);
    await vi.waitFor(() => expect(page.document.querySelector('[data-state="confirmed"]').hidden).toBe(false));
    const posts = fetch.calls.filter((c) => c.path.endsWith('/v1/auth/verify'));
    expect(posts).toHaveLength(1);
    expect(posts[0].init.method).toBe('POST');
    expect(page.navigations).toEqual([]);
  });
});
