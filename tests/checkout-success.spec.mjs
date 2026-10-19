// The success page never trusts the redirect: the licence state comes from
// GET /v1/license/status, and only an active status is reported as activated.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, openPage, resetScripts, runScript, stubFetch } from './helpers/browser.mjs';

const HTML = `<!doctype html><html lang="en"><body>
  <p id="licence-message">Checking your account…</p>
  <a id="licence-login" href="/login/" hidden>Sign in</a>
</body></html>`;
const lic = (license) => ({ license: { accountId: 'a1', ...license }, plans: [] });
const SIGNED_IN = { drafta_access: 'access-1' };
// Query values Robokassa appends; none of them may influence the page.
const FORGED_QUERY = '?InvId=7&OutSum=999.00&SignatureValue=abc&status=active';

let page;
afterEach(() => { page?.close(); page = undefined; });

async function openSuccess({ storage = {}, me, html = HTML } = {}) {
  resetScripts();
  const fetch = stubFetch({ '/v1/license/status': me ?? (() => json(200, {})) });
  page = await openPage({ url: `https://drafta.org/checkout/success/${FORGED_QUERY}`, html, storage, fetch });
  await runScript('src/scripts/pages/checkout-success.ts', 'checkout success');
  return fetch;
}

const message = () => page.document.getElementById('licence-message').textContent;

describe('checkout success page', () => {
  it('[+] an active licence is reported, with the period end when the account has one', async () => {
    await openSuccess({ storage: SIGNED_IN, me: () => json(200, lic({ licensed: true, status: 'active', licenseEndsAt: '2027-10-19T00:00:00Z' })) });
    await vi.waitFor(() => expect(message()).toMatch(/licence is active/i));
    expect(message()).toMatch(/2027/);
  });

  it('[+] sends the bearer token to /v1/license/status', async () => {
    const fetch = await openSuccess({ storage: SIGNED_IN, me: () => json(200, lic({ licensed: true, status: 'active' })) });
    await vi.waitFor(() => expect(fetch.calls).toHaveLength(1));
    expect(fetch.calls[0].init.headers.Authorization).toBe('Bearer access-1');
  });

  it('[-] without a session nothing is fetched and the sign-in link appears', async () => {
    const fetch = await openSuccess();
    await vi.waitFor(() => expect(page.document.getElementById('licence-login').hidden).toBe(false));
    expect(fetch.calls).toEqual([]);
    expect(message()).not.toMatch(/licence is active/i);
  });

  it('[-] a non-active status is shown as pending, whatever the query says', async () => {
    await openSuccess({ storage: SIGNED_IN, me: () => json(200, lic({ licensed: false, status: 'trial', trialDaysLeft: 12 })) });
    await vi.waitFor(() => expect(message()).not.toMatch(/Checking/));
    expect(message()).not.toMatch(/licence is active/i);
  });

  it('[-] status active without licensed=true, and an expired licence, are not reported as active', async () => {
    await openSuccess({ storage: SIGNED_IN, me: () => json(200, lic({ licensed: false, status: 'active' })) });
    await vi.waitFor(() => expect(message()).not.toMatch(/Checking/));
    expect(message()).not.toMatch(/licence is active/i);
    page.close();
    await openSuccess({ storage: SIGNED_IN, me: () => json(200, lic({ licensed: true, status: 'expired' })) });
    await vi.waitFor(() => expect(message()).not.toMatch(/Checking/));
    expect(message()).not.toMatch(/licence is active/i);
  });

  it('[-] a failing license endpoint never claims activation', async () => {
    await openSuccess({ storage: SIGNED_IN, me: () => json(500, { error: 'boom' }) });
    await vi.waitFor(() => expect(message()).not.toMatch(/Checking/));
    expect(message()).not.toMatch(/licence is active/i);
  });

  it('[-] a network failure never claims activation', async () => {
    await openSuccess({ storage: SIGNED_IN, me: () => { throw new TypeError('offline'); } });
    await vi.waitFor(() => expect(message()).not.toMatch(/Checking/));
    expect(message()).not.toMatch(/licence is active/i);
  });
});
