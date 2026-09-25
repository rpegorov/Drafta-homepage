// ЗАДАЧА-1.2 — sign-in page. Expectations come from the brief/plan and the
// behaviour of /login/ at commit c497677, not from the new implementation.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorText, fixture, json, openPage, resetScripts, runScript, stubFetch } from './helpers/browser.mjs';
import { loadRoute } from './helpers/dist.mjs';

const OWNER = 'ЗАДАЧА-1.0/1.2';
const SESSION = { tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' } };

let page;
afterEach(() => { page?.close(); page = undefined; });

async function openLogin(search, loginResponse) {
  resetScripts();
  const fetch = stubFetch({ '/v1/auth/login': loginResponse });
  page = await openPage({ url: `https://drafta.org/login/${search}`, html: fixture('login.html'), fetch });
  await runScript('src/scripts/forms.ts', OWNER);
  await runScript('src/scripts/pages/login.ts', OWNER);
  return fetch;
}

function submit(email, password) {
  const { document, window } = page;
  document.getElementById('email').value = email;
  document.getElementById('password').value = password;
  document.querySelector('[data-login-form]')
    .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

const landedOn = () => page.navigations.map((n) => n.url);

describe('ЗАДАЧА-1.2 login', () => {
  it('[wiring] the built /login/ and /ru/login/ carry the form hooks login.ts drives and load a module script', () => {
    for (const route of ['/login/', '/ru/login/']) {
      const $ = loadRoute(route);
      expect($('form[data-login-form]').length, `${route}: form[data-login-form]`).toBe(1);
      expect($('form[data-login-form] #email').length, `${route}: #email`).toBe(1);
      expect($('form[data-login-form] #password').length, `${route}: #password`).toBe(1);
      expect($('script[type="module"]').length, `${route}: no module script — login.ts is not on the page`).toBeGreaterThan(0);
    }
  });

  it('[+] a same-site ?next= with its own query survives sign-in', async () => {
    const fetch = await openLogin('?next=%2Fcheckout%2F%3Fplan%3Dpro_yearly', () => json(200, SESSION));
    submit('reader@example.com', 'correct horse');
    await vi.waitFor(() => expect(page.navigations.length).toBeGreaterThan(0));
    const target = new URL(landedOn().at(-1));
    expect(target.origin).toBe('https://drafta.org');
    expect(target.pathname + target.search).toBe('/checkout/?plan=pro_yearly');
    expect(fetch.calls.filter((c) => c.path.endsWith('/v1/auth/login'))).toHaveLength(1);
    expect(page.window.localStorage.getItem('drafta_access')).toBe('access-1');
  });

  it('[+] a Russian browser sent to /ru/ keeps ?next= and it is rewritten to the /ru/ twin (ruSearch)', async () => {
    resetScripts();
    page = await openPage({
      url: 'https://drafta.org/login/?next=%2Fcheckout%2F%3Fplan%3Dpro_yearly',
      html: fixture('login.html'),
      languages: ['ru-RU', 'ru'],
      fetch: stubFetch({}),
    });
    await runScript('src/scripts/lang.ts', OWNER);
    expect(page.navigations, 'lang.ts did not send a Russian browser to /ru/').toHaveLength(1);
    const target = new URL(page.navigations[0].url);
    expect(target.pathname).toBe('/ru/login/');
    expect(target.searchParams.get('next')).toBe('/ru/checkout/?plan=pro_yearly');
  });

  it('[+] 401 and 403 both read "Wrong email or password" and do not navigate', async () => {
    for (const status of [401, 403]) {
      page?.close();
      await openLogin('', () => json(status, {}));
      submit('reader@example.com', 'wrong');
      await vi.waitFor(() => expect(errorText(page.document)).not.toBe(''));
      expect(errorText(page.document), `HTTP ${status}`).toMatch(/Wrong email or password/);
      expect(page.navigations, `HTTP ${status}`).toEqual([]);
    }
  });

  it('[-] an off-site ?next= is dropped: https://evil.com, //evil.com and /\\evil.com never become the target', async () => {
    for (const next of ['https://evil.com', '//evil.com', '/\\evil.com']) {
      page?.close();
      await openLogin(`?next=${encodeURIComponent(next)}`, () => json(200, SESSION));
      submit('reader@example.com', 'correct horse');
      await vi.waitFor(() => expect(page.navigations.length).toBeGreaterThan(0));
      for (const url of landedOn()) {
        expect(new URL(url).hostname, `next=${next} led to ${url}`).toBe('drafta.org');
        expect(url, `next=${next}`).not.toMatch(/evil\.com/);
      }
    }
  });

  it('[-] offline: a network failure shows a message and keeps the visitor on the page', async () => {
    await openLogin('', () => { throw new TypeError('Failed to fetch'); });
    submit('reader@example.com', 'correct horse');
    await vi.waitFor(() => expect(errorText(page.document)).not.toBe(''));
    expect(page.navigations).toEqual([]);
    expect(page.window.localStorage.getItem('drafta_access')).toBeNull();
  });

  it('[-] an empty password is refused before any request is sent', async () => {
    const fetch = await openLogin('', () => json(200, SESSION));
    submit('reader@example.com', '');
    await vi.waitFor(() => expect(errorText(page.document)).not.toBe(''));
    expect(fetch).not.toHaveBeenCalled();
    expect(page.navigations).toEqual([]);
  });
});
