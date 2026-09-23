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

  /* Offline render path only. Mirrors GET https://api.drafta.org/v1/plans
     byte for byte (measured 2026-09-23). The API stays the source of truth. */
  planFallback: [
    {"code":"pro_yearly","name":"Pro — yearly","billing":"yearly","priceCents":9588,"monthlyCents":799,"quotaBytes":10737418240,"quotaNotes":100000},
    {"code":"pro_monthly","name":"Pro — monthly","billing":"monthly","priceCents":999,"monthlyCents":999,"quotaBytes":10737418240,"quotaNotes":100000},
    {"code":"lifetime","name":"Lifetime","billing":"one_time","priceCents":9999,"monthlyCents":0,"quotaBytes":10737418240,"quotaNotes":100000}
  ]
};
