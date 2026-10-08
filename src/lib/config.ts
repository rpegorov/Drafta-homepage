/* Drafta — site configuration: the only module that knows an API path.
   Scripts import these names directly (never through window), so a test can
   replace the module with vi.mock('…/src/lib/config') or answer the URLs
   built from `api` with a stubbed fetch. */

import type { Plan } from './types';

export const api = 'https://api.drafta.org';

export const endpoints = {
  plans: '/v1/plans',
  register: '/v1/auth/register',
  login: '/v1/auth/login',
  verify: '/v1/auth/verify',
  me: '/v1/account/me',
  subscribe: '/v1/billing/subscribe',
} as const;

export const releases = 'https://github.com/rpegorov/drafta-releases/releases/latest';

export const verifyPage = '/verify/';

/* Offline render path only — the monthly and yearly options of the one plan.
   The API stays the source of truth; this mirrors the live service's billing
   options and its quota (30 GB / unlimited notes, measured 2026-09-23). There
   is deliberately no lifetime entry: the product does not sell one. Whenever
   the API's codes, prices or quotas change, this list changes with them. */
export const planFallback: readonly Plan[] = [
  { code: 'pro_yearly', name: 'Pro — yearly', billing: 'yearly', priceCents: 9588, monthlyCents: 799, quotaBytes: 32212254720, quotaNotes: 0 },
  { code: 'pro_monthly', name: 'Pro — monthly', billing: 'monthly', priceCents: 999, monthlyCents: 999, quotaBytes: 32212254720, quotaNotes: 0 },
];

/* Rouble prices shown on the Russian pages, keyed by billing period. `perMonth`
   is the yearly plan's monthly equivalent (9,500 / 12, rounded). They mirror the
   legal pages and the offer; the API still serves USD. */
export const rubPrices: Readonly<Record<string, { total: number; perMonth: number }>> = {
  monthly: { total: 990, perMonth: 990 },
  yearly: { total: 9500, perMonth: 792 },
};

/** Capabilities the site shows but does not deliver yet; wave 1 closes with only OWNER fields here. */
export const unwiredCapabilities: string[] = [
  'OWNER: Robokassa is named on the legal pages and the offer but is not wired into checkout yet',
  'OWNER: rouble prices (990 / 9,500 RUB) are display-only on the Russian pricing cards; the API plans and checkout still charge USD',
  'OWNER: support email support@drafta.org on the legal pages receives nothing until mail is set up on the domain',
  'OWNER: jurisdiction, the offer text and the refund rule are drafts pending a lawyer and the seller',
];
