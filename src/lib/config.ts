/* Drafta — site configuration: the only module that knows an API path.
   Scripts import DRAFTA and read its fields at call time, so a test can point
   `DRAFTA.api` at a stub server (or vi.mock this module) before calling them. */

import type { Plan } from './types';

export interface DraftaConfig {
  api: string;
  endpoints: {
    plans: string;
    register: string;
    login: string;
    verify: string;
    me: string;
    subscribe: string;
  };
  releases: string;
  verifyPage: string;
  planFallback: Plan[];
  /** Capabilities the site shows but does not deliver yet; wave 1 closes with it empty. */
  unwiredCapabilities: string[];
}

export const DRAFTA: DraftaConfig = {
  api: 'https://api.drafta.org',
  endpoints: {
    plans: '/v1/plans',
    register: '/v1/auth/register',
    login: '/v1/auth/login',
    verify: '/v1/auth/verify',
    me: '/v1/account/me',
    subscribe: '/v1/billing/subscribe',
  },
  releases: 'https://github.com/rpegorov/drafta-releases/releases/latest',
  verifyPage: '/verify/',

  /* Offline render path only — the monthly and yearly options of the one plan.
     The API stays the source of truth; this mirrors the live service's billing
     options and its quota (30 GB / unlimited notes, measured 2026-09-23). There
     is deliberately no lifetime entry: the product does not sell one. Whenever
     the API's codes, prices or quotas change, this list changes with them. */
  planFallback: [
    { code: 'pro_yearly', name: 'Pro — yearly', billing: 'yearly', priceCents: 9588, monthlyCents: 799, quotaBytes: 32212254720, quotaNotes: 0 },
    { code: 'pro_monthly', name: 'Pro — monthly', billing: 'monthly', priceCents: 999, monthlyCents: 999, quotaBytes: 32212254720, quotaNotes: 0 },
  ],

  unwiredCapabilities: [],
};

export default DRAFTA;
