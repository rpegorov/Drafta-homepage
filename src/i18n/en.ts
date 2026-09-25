/* English UI strings. The Russian dictionary must have exactly these keys (see ru.ts).
   Form messages are forms.js's MESSAGES, pricing copy is plans.js's COPY, both 1:1. */

export const en = {
  /* ---- form messages (forms.ts) ---- */
  emailRequired: 'Enter your email address.',
  emailInvalid: 'That does not look like an email address.',
  emailSpaces: 'An email address cannot contain spaces.',
  passwordShort: 'Password must be at least 8 characters.',
  passwordLong: 'Password must be at most 1024 characters.',
  offline: 'Could not reach Drafta. Check your connection and try again.',
  badResponse: 'The server sent an unexpected response.',

  /* ---- pricing copy (plans.ts) ---- */
  periodLabel: { monthly: 'Monthly billing', yearly: 'Annual billing' } as Record<string, string>,
  periodShort: { monthly: 'month', yearly: 'year' } as Record<string, string>,
  billedAnnually: '{value} billed annually',
  cloudSync: 'Cloud sync',
  noFees: 'No setup or hidden fees',
  unlimitedStorage: 'Unlimited storage',
  unlimitedNotes: 'Unlimited notes',
  gb: 'GB',
  storage: 'storage',
  note: (n: number): string => (n === 1 ? 'note' : 'notes'),
  trial: 'Both billing options start with a 30-day trial — no card required, and you can change your mind later.',
  choose: { monthly: 'Choose monthly', yearly: 'Choose annual' } as Record<string, string>,

  /* ---- page chrome (Base, Header, Footer) ---- */
  skipLink: 'Skip to content',
  navLabel: 'Main',
  menu: 'Menu',
  navFeatures: 'Features',
  navPricing: 'Pricing',
  navFaq: 'FAQ',
  navDocs: 'Docs',
  download: 'Download',
  langSwitchLabel: 'Language',
  footerProduct: 'Product',
  footerFeatures: 'Features',
  footerPricing: 'Pricing',
  footerPlans: 'Plans',
  footerAccount: 'Account',
  footerRegister: 'Create account',
  footerSignIn: 'Sign in',
  footerFaq: 'FAQ',
  footerDownloads: 'Downloads',
  footerLatestRelease: 'Latest release',
  footerLegal: 'Legal',
  footerTerms: 'Terms',
  footerPrivacy: 'Privacy',
  footerRefund: 'Refund',
  footerContact: 'Contact',
  footerCopyright: '© 2026 Drafta · Apache-2.0',
  footerMadeBy: 'by craftzman',
};

export type Messages = typeof en;
export type MessageKey = keyof Messages;
