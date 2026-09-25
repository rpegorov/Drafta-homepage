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

/** Capabilities the site shows but does not deliver yet; wave 1 closes with only OWNER fields here. */
export const unwiredCapabilities: string[] = [
  'OWNER: seller name and INN on /terms/, /privacy/, /refund/, /contact/ (EN and RU) are placeholders',
  'OWNER: support email support@drafta.org on the legal pages is unconfirmed',
  'OWNER: jurisdiction on the legal pages is a draft',
  'OWNER: refund rule on /refund/ is a draft',
];
