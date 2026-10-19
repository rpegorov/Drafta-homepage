// ЗАДАЧА-1.3 — checkout. Expectations come from PLAN v2 §5 (acceptance
// scenario 1: sessionless ?plan=pro_yearly goes to login and back; /v1/plans is
// fetched once) and /checkout/ at commit c497677.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture, json, openPage, resetScripts, runScript, stubFetch } from './helpers/browser.mjs';
import { loadRoute } from './helpers/dist.mjs';

const OWNER = 'ЗАДАЧА-1.0/1.3';
const PLANS = {
  plans: [
    { code: 'pro_yearly', name: 'Pro — yearly', billing: 'yearly', priceCents: 9588, monthlyCents: 799, quotaBytes: 32212254720, quotaNotes: 0 },
    { code: 'pro_monthly', name: 'Pro — monthly', billing: 'monthly', priceCents: 999, monthlyCents: 999, quotaBytes: 32212254720, quotaNotes: 0 },
  ],
};
const SIGNED_IN = { drafta_access: 'access-1', drafta_email: 'reader@example.com' };

let page;
afterEach(() => { page?.close(); page = undefined; });

const PAYMENT_URL = 'https://auth.robokassa.ru/Merchant/Index.aspx?InvId=7';

async function openCheckout({
  search = '', storage = {}, plans = () => json(200, PLANS),
  subscribe = () => json(200, { paymentUrl: PAYMENT_URL, invId: 7 }),
} = {}) {
  resetScripts();
  const fetch = stubFetch({
    '/v1/plans': plans,
    '/v1/billing/subscribe': subscribe,
  });
  page = await openPage({ url: `https://drafta.org/checkout/${search}`, html: fixture('checkout.html'), storage, fetch });
  await runScript('src/scripts/forms.ts', OWNER);
  await runScript('src/scripts/plans.ts', OWNER);
  await runScript('src/scripts/pages/checkout.ts', OWNER);
  return fetch;
}

const planCalls = (fetch) => fetch.calls.filter((c) => c.path.endsWith('/v1/plans'));

describe('ЗАДАЧА-1.3 checkout', () => {
  it('[wiring] the built /checkout/ and /ru/checkout/ carry the hooks checkout.ts drives and load a module script', () => {
    for (const route of ['/checkout/', '/ru/checkout/']) {
      const $ = loadRoute(route);
      for (const hook of ['[data-plans]', '#order-form', '#order-hint', '#order-login']) {
        expect($(hook).length, `${route}: ${hook}`).toBe(1);
      }
      expect($('script[type="module"]').length, `${route}: no module script — checkout.ts is not on the page`).toBeGreaterThan(0);
    }
  });

  it('[+] without a session ?plan=pro_yearly sends the visitor to /login/?next=%2Fcheckout%2F%3Fplan%3Dpro_yearly', async () => {
    await openCheckout({ search: '?plan=pro_yearly' });
    await vi.waitFor(() => expect(page.navigations.length).toBeGreaterThan(0));
    const target = new URL(page.navigations[0].url);
    expect(target.origin).toBe('https://drafta.org');
    expect(target.pathname + target.search).toBe('/login/?next=%2Fcheckout%2F%3Fplan%3Dpro_yearly');
  });

  it('[+] loadPlans called three times makes one request and gives all three callers the plans', async () => {
    resetScripts();
    const fetch = stubFetch({ '/v1/plans': () => json(200, PLANS) });
    page = await openPage({ url: 'https://drafta.org/', html: '<!doctype html><html lang="en"><body></body></html>', fetch });
    const mod = await runScript('src/scripts/plans.ts', OWNER);
    const loadPlans = mod.loadPlans ?? globalThis.window?.DRAFTA?.loadPlans;
    expect(loadPlans, 'src/scripts/plans.ts exports no loadPlans').toBeTypeOf('function');
    const results = await Promise.all([loadPlans(), loadPlans(), loadPlans()]);
    expect(planCalls(fetch)).toHaveLength(1);
    for (const list of results) expect(list.map((p) => p.code).sort()).toEqual(['pro_monthly', 'pro_yearly']);
  });

  it('[+] signed in, ?plan=pro_yearly marks the yearly card as selected and the page requests /v1/plans once', async () => {
    const fetch = await openCheckout({ search: '?plan=pro_yearly', storage: SIGNED_IN });
    await vi.waitFor(() => expect(page.document.querySelectorAll('[data-plans] .plan').length).toBe(2));
    const selected = [...page.document.querySelectorAll('[data-plans] .plan--selected')];
    expect(selected, 'exactly one card is selected').toHaveLength(1);
    expect(selected[0].getAttribute('data-period')).toBe('yearly');
    expect(page.navigations).toEqual([]);
    expect(planCalls(fetch)).toHaveLength(1);
  });

  it('[-] /v1/plans failing still renders both cards from planFallback with 9.99 and 95.88', async () => {
    await openCheckout({ storage: SIGNED_IN, plans: () => json(500, { error: 'boom' }) });
    await vi.waitFor(() => expect(page.document.querySelectorAll('[data-plans] .plan').length).toBe(2));
    const text = page.document.querySelector('[data-plans]').textContent;
    expect(text).toMatch(/9\.99/);
    expect(text).toMatch(/95\.88/);
  });

  it('[-] no session and no ?plan: no redirect, the sign-in link carries next=/checkout/', async () => {
    await openCheckout();
    await vi.waitFor(() => expect(page.document.getElementById('order-login').hidden).toBe(false));
    expect(page.navigations).toEqual([]);
    const href = new URL(page.document.getElementById('order-login').getAttribute('href'), 'https://drafta.org');
    expect(href.pathname).toBe('/login/');
    expect(href.searchParams.get('next')).toBe('/checkout/');
  });

  it('[-] signed in with ?plan= nothing is posted on load — subscribe needs the card\'s own button', async () => {
    const fetch = await openCheckout({ search: '?plan=pro_yearly', storage: SIGNED_IN });
    await vi.waitFor(() => expect(page.document.querySelectorAll('[data-plans] .plan').length).toBe(2));
    expect(fetch.calls.filter((c) => c.path.endsWith('/v1/billing/subscribe'))).toEqual([]);
  });

  describe('subscribe', () => {
    const subscribeCalls = (fetch) => fetch.calls.filter((c) => c.path.endsWith('/v1/billing/subscribe'));
    const cta = (code) => page.document.querySelector(`[data-plans] .plan__cta[data-plan="${code}"]`);

    async function pressPlan(options, code = 'pro_yearly') {
      const fetch = await openCheckout({ storage: SIGNED_IN, ...options });
      await vi.waitFor(() => expect(cta(code)).not.toBeNull());
      cta(code).click();
      return fetch;
    }

    it('[+] posts the plan and the page language with the bearer token, then goes to the https paymentUrl', async () => {
      const fetch = await pressPlan();
      await vi.waitFor(() => expect(page.navigations.length).toBeGreaterThan(0));
      expect(page.navigations.at(-1).url).toBe(PAYMENT_URL);
      const [call] = subscribeCalls(fetch);
      expect(JSON.parse(call.init.body)).toEqual({ plan: 'pro_yearly', lang: 'en' });
      expect(call.init.headers.Authorization).toBe('Bearer access-1');
      expect(cta('pro_yearly').disabled, 'busy until the navigation replaces the page').toBe(true);
    });

    it('[-] a non-https paymentUrl is rejected: no navigation, an error is shown, the button is usable again', async () => {
      await pressPlan({ subscribe: () => json(200, { paymentUrl: 'http://auth.robokassa.ru/pay', invId: 7 }) });
      await vi.waitFor(() => expect(page.document.getElementById('order-error').textContent).not.toBe(''));
      expect(page.navigations).toEqual([]);
      expect(cta('pro_yearly').disabled).toBe(false);
    });

    it('[-] a response without paymentUrl is rejected the same way and never reports a purchase', async () => {
      await pressPlan({ subscribe: () => json(200, { plan: 'pro_yearly', status: 'active' }) });
      await vi.waitFor(() => expect(page.document.getElementById('order-error').textContent).not.toBe(''));
      expect(page.navigations).toEqual([]);
      expect(page.document.getElementById('order-ok').textContent).toBe('');
    });

    it('[-] 401 shows the server error, the sign-in link, and does not navigate', async () => {
      await pressPlan({ subscribe: () => json(401, { error: 'token expired' }) });
      await vi.waitFor(() => expect(page.document.getElementById('order-error').textContent).toBe('token expired'));
      expect(page.document.getElementById('order-login').hidden).toBe(false);
      expect(page.navigations).toEqual([]);
    });
  });
});
