import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadWith(fetchImpl) {
  vi.resetModules();
  vi.stubGlobal('fetch', fetchImpl);
  const mod = await import('../src/scripts/plans.ts');
  return mod;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadAutoRenewAvailable', () => {
  it('is true when GET /v1/plans reports autoRenew.available', async () => {
    const { loadAutoRenewAvailable } = await loadWith(async () => jsonResponse({ plans: [], autoRenew: { available: true } }));
    expect(await loadAutoRenewAvailable()).toBe(true);
  });

  it('is false when the flag is off', async () => {
    const { loadAutoRenewAvailable } = await loadWith(async () => jsonResponse({ plans: [], autoRenew: { available: false } }));
    expect(await loadAutoRenewAvailable()).toBe(false);
  });

  it('is false when the autoRenew block is absent', async () => {
    const { loadAutoRenewAvailable } = await loadWith(async () => jsonResponse({ plans: [] }));
    expect(await loadAutoRenewAvailable()).toBe(false);
  });

  it('is false when autoRenew is null or the flag is not a boolean true', async () => {
    const nullBlock = await loadWith(async () => jsonResponse({ plans: [], autoRenew: null }));
    expect(await nullBlock.loadAutoRenewAvailable()).toBe(false);
    const stringFlag = await loadWith(async () => jsonResponse({ plans: [], autoRenew: { available: 'true' } }));
    expect(await stringFlag.loadAutoRenewAvailable()).toBe(false);
  });

  it('is false on an HTTP error', async () => {
    const { loadAutoRenewAvailable } = await loadWith(async () => jsonResponse({ autoRenew: { available: true } }, 500));
    expect(await loadAutoRenewAvailable()).toBe(false);
  });

  it('is false when the network request rejects', async () => {
    const { loadAutoRenewAvailable } = await loadWith(() => Promise.reject(new Error('offline')));
    expect(await loadAutoRenewAvailable()).toBe(false);
  });

  it('is false when the body is not JSON', async () => {
    const { loadAutoRenewAvailable } = await loadWith(async () => new Response('<html>', { status: 200 }));
    expect(await loadAutoRenewAvailable()).toBe(false);
  });

  it('shares the plans request: one fetch serves both the plan list and the flag', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ plans: [], autoRenew: { available: true } }));
    const { loadAutoRenewAvailable, loadPlans } = await loadWith(fetchSpy);
    expect(await loadAutoRenewAvailable()).toBe(true);
    await loadPlans();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
