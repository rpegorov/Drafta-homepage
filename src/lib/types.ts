/* Shapes the site exchanges with the accounts API. */

export type Lang = 'en' | 'ru';

export type Billing = 'monthly' | 'yearly' | 'one_time';

/** One entry of GET /v1/plans → {plans: Plan[]}. */
export interface Plan {
  code: string;
  name: string;
  billing: Billing | string;
  priceCents: number;
  monthlyCents: number;
  /** Storage quota in bytes; 0 or less means unlimited. */
  quotaBytes: number;
  /** Note quota; 0 or less means unlimited. */
  quotaNotes: number;
}

/** What post() resolves to. `data.error` carries the server's message when present. */
export interface PostResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown> & { error?: string };
}
