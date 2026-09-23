/* Drafta — site configuration.
   §5 of the build contract: the only file in the repository that knows an API
   path. Pages read window.DRAFTA and never build a URL of their own. */

window.DRAFTA = {
  api: 'https://api.drafta.org',
  endpoints: {
    plans:     '/v1/plans',
    register:  '/v1/auth/register',
    login:     '/v1/auth/login',
    verify:    '/v1/auth/verify',      // owned by the parallel backend session
    me:        '/v1/account/me',
    subscribe: '/v1/billing/subscribe'
  },
  releases: 'https://github.com/rpegorov/drafta-releases/releases/latest',
  verifyPage: '/verify/',

  /* Offline render path only — the monthly and yearly options of the one plan.
     The API stays the source of truth (§7); this mirrors the live service's
     billing options and its current quota (10 GiB / 100 000, measured
     2026-09-23). There is deliberately no lifetime entry: the product no longer
     sells one, so the offline path must not advertise it. */
  planFallback: [
    {"code":"pro_yearly","name":"Pro — yearly","billing":"yearly","priceCents":9588,"monthlyCents":799,"quotaBytes":10737418240,"quotaNotes":100000},
    {"code":"pro_monthly","name":"Pro — monthly","billing":"monthly","priceCents":999,"monthlyCents":999,"quotaBytes":10737418240,"quotaNotes":100000}
  ]
};
