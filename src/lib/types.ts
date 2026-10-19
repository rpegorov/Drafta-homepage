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
  /** True when the body was not JSON; `data` then carries a fallback message. */
  unparsed?: boolean;
}

/** One entry of GET /v1/billing/orders → {orders: AccountOrder[]}; amounts are roubles in kopecks. */
export interface AccountOrder {
  invId: number;
  createdAt: string;
  plan: string;
  amountKopecks: number;
  status: string;
}

/** What the account page shows for the licence; `until` is an already formatted date. */
export type LicenceView =
  | { kind: 'trial'; daysLeft: number }
  | { kind: 'active'; until: string }
  | { kind: 'lifetime' }
  | { kind: 'expired' }
  | { kind: 'unknown' };

/** One formatted line of the order history. */
export interface OrderRow {
  invId: number;
  date: string;
  plan: string;
  amount: string;
  status: 'paid' | 'pending' | 'unpaid' | 'other';
  statusLabel: string;
}

/** The `autoRenew` block of GET /v1/plans. */
export interface AutoRenewInfo {
  available: boolean;
}

export type AutoRenewStopReason = 'user' | 'superseded' | 'failures' | 'price_changed' | 'plan_unavailable' | 'expired';

/** The `autoRenew` record of GET /v1/billing/autorenew; no ids and no contact data. */
export interface AutoRenewRecord {
  status: 'active' | 'past_due' | 'cancelled';
  plan: string;
  amountKopecks: number;
  nextChargeAt: string | null;
  chargeInFlight: boolean;
  stopReason: AutoRenewStopReason | null;
}

/** What the account page shows for auto-renewal; `amount`, `plan` and `next` are already formatted. */
export type AutoRenewView =
  | { kind: 'hidden' }
  | { kind: 'off' }
  | { kind: 'active'; amount: string; plan: string; next: string | null; inFlight: boolean }
  | { kind: 'past_due'; reason: 'failures' | 'price_changed' | 'plan_unavailable' | 'expired' | 'other' }
  | { kind: 'cancelled' }
  | { kind: 'unknown' };
