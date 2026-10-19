// The account page script: parallel loads, independent block errors, 401 handling,
// textContent-only output, sign-out and the header link.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, openPage, resetScripts, runScript, stubFetch } from './helpers/browser.mjs';

const HTML = (lang) => `<!doctype html><html lang="${lang}"><body>
  <a data-account-link href="/account/" hidden>Account</a>
  <div data-licence><p data-licence-text>Checking…</p></div>
  <div data-licence-error hidden><button data-licence-retry type="button">retry</button></div>
  <span data-account-email></span><span data-account-verified hidden>confirmed</span>
  <div data-orders-table hidden><table><tbody data-orders></tbody></table></div>
  <p data-orders-empty hidden>No payments yet.</p>
  <div data-orders-error hidden><button data-orders-retry type="button">retry</button></div>
  <div data-autorenew-block hidden>
    <p data-autorenew-text></p><p data-autorenew-detail hidden></p><p data-autorenew-flight hidden></p>
    <button data-autorenew-cancel type="button" hidden>Turn off</button>
    <p data-autorenew-cancel-error hidden>cancel failed</p>
    <div data-autorenew-error hidden><button data-autorenew-retry type="button">retry</button></div>
  </div>
  <a data-renew="pro_monthly" href="/checkout/?plan=pro_monthly">month</a>
  <a data-renew="pro_yearly" href="/checkout/?plan=pro_yearly">year</a>
  <p data-renew-note id="account-renew-note" hidden></p>
  <button data-logout type="button">Sign out</button>
</body></html>`;
const SIGNED_IN = { drafta_access: 'acc-1', drafta_refresh: 'ref-1', drafta_email: 'stored@example.com' };
const ORDER = { invId: 42, createdAt: '2026-10-19T09:12:03Z', plan: 'pro_yearly', amountKopecks: 950000, status: 'paid' };
const ok = {
  '/v1/license/status': () => json(200, { license: { status: 'trial', trialDaysLeft: 12 } }),
  '/v1/account/me': () => json(200, { email: 'me@example.com', emailVerified: true }),
  '/v1/billing/orders': () => json(200, { orders: [ORDER] }),
  '/v1/billing/autorenew': () => json(200, { available: false, autoRenew: null }),
  '/v1/plans': () => json(200, { plans: [], autoRenew: { available: false } }),
};
const PLANS_ON = { '/v1/plans': () => json(200, { plans: [], autoRenew: { available: true } }) };
const RECORD = {
  status: 'active', plan: 'pro_monthly', amountKopecks: 99000,
  nextChargeAt: '2026-11-16T00:00:00Z', chargeInFlight: false, stopReason: null,
};
const withRecord = (record, available = true) => ({ '/v1/billing/autorenew': () => json(200, { available, autoRenew: record }) });

let page;
afterEach(() => { page?.close(); page = undefined; });

async function open({ lang = 'en', path, storage = SIGNED_IN, routes = {} } = {}) {
  resetScripts();
  const fetch = stubFetch({ ...ok, '/v1/auth/logout': () => json(200, { status: 'logged_out' }), ...routes });
  const url = `https://drafta.org${path ?? (lang === 'ru' ? '/ru/account/' : '/account/')}`;
  page = await openPage({ url, html: HTML(lang), storage, fetch });
  await runScript('src/scripts/pages/account.ts', 'account page');
  return fetch;
}

const q = (hook) => page.document.querySelector(`[${hook}]`);
const settle = () => vi.waitFor(() => expect(q('data-licence-text').textContent).not.toBe('Checking…'));
const lastNav = () => page.navigations.at(-1)?.url;

describe('account page', () => {
  it('[+] fills licence, email, verified mark and orders, with the bearer token on all three calls', async () => {
    const fetch = await open();
    await vi.waitFor(() => expect(q('data-orders').children).toHaveLength(1));
    expect(q('data-licence-text').textContent).toMatch(/12/);
    expect(q('data-account-email').textContent).toBe('me@example.com');
    expect(q('data-account-verified').hidden).toBe(false);
    expect(q('data-orders-table').hidden).toBe(false);
    expect(q('data-orders-empty').hidden).toBe(true);
    expect(q('data-orders').textContent).toMatch(/9,500/);
    const authed = fetch.calls.filter((c) => c.path !== '/v1/plans');
    expect(authed.map((c) => c.path).sort()).toEqual(['/v1/account/me', '/v1/billing/autorenew', '/v1/billing/orders', '/v1/license/status']);
    for (const call of authed) expect(call.init.headers.Authorization).toBe('Bearer acc-1');
  });

  it('[+] the Russian page renders Russian text', async () => {
    await open({ lang: 'ru' });
    await vi.waitFor(() => expect(q('data-orders').children).toHaveLength(1));
    expect(q('data-orders').textContent).toMatch(/₽/);
    expect(q('data-licence-text').textContent).toMatch(/Триал|дн/i);
  });

  it('[+] an empty history hides the table and shows the empty state', async () => {
    await open({ routes: { '/v1/billing/orders': () => json(200, { orders: [] }) } });
    await vi.waitFor(() => expect(q('data-orders-empty').hidden).toBe(false));
    expect(q('data-orders-table').hidden).toBe(true);
    expect(q('data-orders-error').hidden).toBe(true);
  });

  it('[+] the header link appears with a session', async () => {
    await open();
    await settle();
    expect(q('data-account-link').hidden).toBe(false);
  });

  it('[-] without a session: redirect to login with next, nothing fetched', async () => {
    const fetch = await open({ storage: {} });
    expect(lastNav()).toBe('https://drafta.org/login/?next=%2Faccount%2F');
    expect(fetch.calls).toEqual([]);
    expect(q('data-account-link').hidden).toBe(true);
  });

  it('[-] without a session on the Russian page the next path stays Russian', async () => {
    await open({ lang: 'ru', storage: {} });
    expect(lastNav()).toBe('https://drafta.org/ru/login/?next=%2Fru%2Faccount%2F');
  });

  it('[-] a 401 clears the session and goes to login', async () => {
    await open({ routes: { '/v1/billing/orders': () => json(401, { error: 'invalid or expired token' }) } });
    await vi.waitFor(() => expect(lastNav()).toBe('https://drafta.org/login/?next=%2Faccount%2F'));
    expect(localStorage.getItem('drafta_access')).toBeNull();
    expect(localStorage.getItem('drafta_refresh')).toBeNull();
  });

  it('[-] a failing orders request leaves the licence visible and retries only orders', async () => {
    let calls = 0;
    const fetch = await open({ routes: { '/v1/billing/orders': () => (calls++ ? json(200, { orders: [ORDER] }) : json(500, {})) } });
    await vi.waitFor(() => expect(q('data-orders-error').hidden).toBe(false));
    expect(q('data-licence-text').textContent).toMatch(/12/);
    expect(q('data-licence-error').hidden).toBe(true);
    const before = fetch.calls.length;
    q('data-orders-retry').click();
    await vi.waitFor(() => expect(q('data-orders').children).toHaveLength(1));
    expect(fetch.calls.slice(before).map((c) => c.path)).toEqual(['/v1/billing/orders']);
    expect(q('data-orders-error').hidden).toBe(true);
  });

  it('[-] a failing licence request shows its own error, orders stay, retry reloads only the licence', async () => {
    let calls = 0;
    const fetch = await open({ routes: { '/v1/license/status': () => (calls++ ? json(200, { license: { status: 'expired' } }) : json(500, {})) } });
    await vi.waitFor(() => expect(q('data-licence-error').hidden).toBe(false));
    expect(q('data-licence').hidden).toBe(true);
    await vi.waitFor(() => expect(q('data-orders').children).toHaveLength(1));
    const before = fetch.calls.length;
    q('data-licence-retry').click();
    await vi.waitFor(() => expect(q('data-licence-error').hidden).toBe(true));
    expect(q('data-licence').hidden).toBe(false);
    expect(fetch.calls.slice(before).map((c) => c.path)).toEqual(['/v1/license/status']);
  });

  it('[-] a payload off the contract is an error, never an empty history or a guessed status', async () => {
    await open({ routes: {
      '/v1/billing/orders': () => json(200, { orders: null }),
      '/v1/license/status': () => json(200, { license: { status: 'mystery' } }),
    } });
    await vi.waitFor(() => expect(q('data-orders-error').hidden).toBe(false));
    await vi.waitFor(() => expect(q('data-licence-error').hidden).toBe(false));
    expect(q('data-orders-empty').hidden).toBe(true);
  });

  it('[-] a network failure on every call shows both errors, no crash', async () => {
    const boom = () => { throw new TypeError('offline'); };
    await open({ routes: { '/v1/license/status': boom, '/v1/account/me': boom, '/v1/billing/orders': boom } });
    await vi.waitFor(() => expect(q('data-orders-error').hidden).toBe(false));
    await vi.waitFor(() => expect(q('data-licence-error').hidden).toBe(false));
    expect(q('data-account-email').textContent).toBe('stored@example.com');
    expect(q('data-account-verified').hidden).toBe(true);
  });

  it('[-] server strings are written as text, never parsed as HTML', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    await open({ routes: {
      '/v1/account/me': () => json(200, { email: evil, emailVerified: true }),
      '/v1/billing/orders': () => json(200, { orders: [{ ...ORDER, plan: evil }] }),
    } });
    await vi.waitFor(() => expect(q('data-account-email').textContent).toBe(evil));
    await vi.waitFor(() => expect(q('data-orders').children).toHaveLength(1));
    expect(page.document.querySelector('img')).toBeNull();
  });

  it('[+] sign out sends the refresh token, clears the session and goes home', async () => {
    const fetch = await open();
    await settle();
    q('data-logout').click();
    await vi.waitFor(() => expect(lastNav()).toBe('https://drafta.org/'));
    const call = fetch.calls.find((c) => c.path === '/v1/auth/logout');
    expect(JSON.parse(call.init.body)).toEqual({ refreshToken: 'ref-1' });
    expect(localStorage.length).toBe(0);
  });

  it('[+] sign out on the Russian page goes to /ru/', async () => {
    await open({ lang: 'ru' });
    await settle();
    q('data-logout').click();
    await vi.waitFor(() => expect(lastNav()).toBe('https://drafta.org/ru/'));
  });

  it('[-] sign out still completes when the logout call fails', async () => {
    await open({ routes: { '/v1/auth/logout': () => { throw new TypeError('offline'); } } });
    await settle();
    q('data-logout').click();
    await vi.waitFor(() => expect(lastNav()).toBe('https://drafta.org/'));
    expect(localStorage.length).toBe(0);
  });

  describe('auto-renewal block', () => {
    const shown = () => vi.waitFor(() => expect(q('data-autorenew-block').hidden).toBe(false));
    const confirmWith = (answer) => { page.window.confirm = vi.fn(() => answer); return page.window.confirm; };

    it('[+] stays hidden while unavailable and without a record, and the renew buttons are unmarked', async () => {
      await open();
      await vi.waitFor(() => expect(q('data-orders').children).toHaveLength(1));
      expect(q('data-autorenew-block').hidden).toBe(true);
      expect(q('data-renew-note').hidden).toBe(true);
    });

    it('[+] available with no record shows the off state without a cancel button', async () => {
      await open({ routes: PLANS_ON });
      await shown();
      expect(q('data-autorenew-text').textContent).toBe('Off.');
      expect(q('data-autorenew-cancel').hidden).toBe(true);
    });

    it('[+] an active record shows plan, amount, next charge and the cancel button', async () => {
      await open({ routes: { ...PLANS_ON, ...withRecord(RECORD) } });
      await shown();
      expect(q('data-autorenew-text').textContent).toMatch(/Next charge: .*2026/);
      expect(q('data-autorenew-detail').textContent).toMatch(/990/);
      expect(q('data-autorenew-cancel').hidden).toBe(false);
      expect(q('data-renew-note').hidden).toBe(true);
    });

    it('[+] the Russian page shows Russian text', async () => {
      await open({ lang: 'ru', routes: { ...PLANS_ON, ...withRecord(RECORD) } });
      await shown();
      expect(q('data-autorenew-text').textContent).toMatch(/Следующее списание/);
    });

    it('[+] flag off with an existing active record still shows the block with cancel, saying charges are paused', async () => {
      await open({ routes: withRecord(RECORD, false) });
      await shown();
      expect(q('data-autorenew-text').textContent).toMatch(/paused/);
      expect(q('data-autorenew-cancel').hidden).toBe(false);
    });

    it('[+] past_due and cancelled records show their reason without a cancel button', async () => {
      await open({ routes: withRecord({ ...RECORD, status: 'past_due', nextChargeAt: null, stopReason: 'price_changed' }, false) });
      await shown();
      expect(q('data-autorenew-text').textContent).toMatch(/price/i);
      expect(q('data-autorenew-cancel').hidden).toBe(true);
      page.close();
      await open({ routes: withRecord({ ...RECORD, status: 'cancelled', nextChargeAt: null, stopReason: 'plan_switched' }, false) });
      await shown();
      expect(q('data-autorenew-text').textContent).toMatch(/another plan/);
      expect(q('data-autorenew-cancel').hidden).toBe(true);
    });

    it('[+] a charge in flight marks the renew buttons with the explanation', async () => {
      await open({ routes: { ...PLANS_ON, ...withRecord({ ...RECORD, chargeInFlight: true, nextChargeAt: null }) } });
      await shown();
      expect(q('data-renew-note').hidden).toBe(false);
      expect(q('data-renew-note').textContent).toMatch(/in progress/);
      for (const link of page.document.querySelectorAll('[data-renew]')) {
        expect(link.getAttribute('aria-describedby')).toBe('account-renew-note');
      }
    });

    it('[+] cancel asks first, warns about a charge in flight, then POSTs with the bearer and reloads the block', async () => {
      let record = RECORD;
      const fetch = await open({ routes: {
        ...PLANS_ON,
        '/v1/billing/autorenew': () => json(200, { available: true, autoRenew: record }),
        '/v1/billing/autorenew/cancel': () => { record = { ...RECORD, status: 'cancelled', nextChargeAt: null, stopReason: 'user' }; return json(200, {}); },
      } });
      await shown();
      const confirm = confirmWith(true);
      q('data-autorenew-cancel').click();
      await vi.waitFor(() => expect(q('data-autorenew-cancel').hidden).toBe(true));
      expect(confirm.mock.calls[0][0]).toMatch(/already started may still go through/);
      const post = fetch.calls.find((c) => c.path === '/v1/billing/autorenew/cancel');
      expect(post.init.method).toBe('POST');
      expect(post.init.headers.Authorization).toBe('Bearer acc-1');
      expect(q('data-autorenew-text').textContent).toMatch(/stays active/);
      expect(fetch.calls.filter((c) => c.path === '/v1/billing/autorenew')).toHaveLength(2);
    });

    it('[-] a declined confirmation sends nothing', async () => {
      const fetch = await open({ routes: { ...PLANS_ON, ...withRecord(RECORD) } });
      await shown();
      confirmWith(false);
      q('data-autorenew-cancel').click();
      await new Promise((done) => setTimeout(done, 20));
      expect(fetch.calls.some((c) => c.path.endsWith('/cancel'))).toBe(false);
    });

    it('[-] a failed cancel shows its error and keeps the record and the button', async () => {
      await open({ routes: { ...PLANS_ON, ...withRecord(RECORD), '/v1/billing/autorenew/cancel': () => json(500, {}) } });
      await shown();
      confirmWith(true);
      q('data-autorenew-cancel').click();
      await vi.waitFor(() => expect(q('data-autorenew-cancel-error').hidden).toBe(false));
      expect(q('data-autorenew-cancel').hidden).toBe(false);
      expect(q('data-autorenew-cancel').disabled).toBe(false);
    });

    it('[-] a 401 on cancel goes to login', async () => {
      await open({ routes: { ...PLANS_ON, ...withRecord(RECORD), '/v1/billing/autorenew/cancel': () => json(401, {}) } });
      await shown();
      confirmWith(true);
      q('data-autorenew-cancel').click();
      await vi.waitFor(() => expect(lastNav()).toBe('https://drafta.org/login/?next=%2Faccount%2F'));
    });

    it('[-] a failing GET shows its own error with retry, the licence and orders stay, retry reloads only this block', async () => {
      let calls = 0;
      const fetch = await open({ routes: { ...PLANS_ON, '/v1/billing/autorenew': () => (calls++ ? json(200, { available: true, autoRenew: RECORD }) : json(500, {})) } });
      await vi.waitFor(() => expect(q('data-autorenew-error').hidden).toBe(false));
      await vi.waitFor(() => expect(q('data-orders').children).toHaveLength(1));
      expect(q('data-licence-error').hidden).toBe(true);
      expect(q('data-orders-error').hidden).toBe(true);
      const before = fetch.calls.length;
      q('data-autorenew-retry').click();
      await vi.waitFor(() => expect(q('data-autorenew-error').hidden).toBe(true));
      expect(q('data-autorenew-cancel').hidden).toBe(false);
      expect(fetch.calls.slice(before).map((c) => c.path)).toEqual(['/v1/billing/autorenew']);
    });

    it('[-] a record off the contract is an error, and a failing licence request does not touch the block', async () => {
      await open({ routes: { ...PLANS_ON, ...withRecord({ status: 'mystery' }), '/v1/license/status': () => json(500, {}) } });
      await vi.waitFor(() => expect(q('data-autorenew-error').hidden).toBe(false));
      await vi.waitFor(() => expect(q('data-licence-error').hidden).toBe(false));
    });

    it('[-] a failing GET while charges are not offered keeps the block hidden', async () => {
      await open({ routes: { '/v1/billing/autorenew': () => json(404, {}) } });
      await vi.waitFor(() => expect(q('data-orders').children).toHaveLength(1));
      expect(q('data-autorenew-block').hidden).toBe(true);
    });
  });
});
