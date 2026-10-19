/* Pure view model for the account page: server payloads in, display values out.
   No DOM and no fetch. Dates are formatted in UTC so the server's instant never
   drifts to a neighbouring day in the visitor's timezone. */

import { t } from '../i18n';
import type {
  AccountOrder,
  AutoRenewCancelReason,
  AutoRenewPastDueReason,
  AutoRenewRecord,
  AutoRenewView,
  Lang,
  LicenceView,
  OrderRow,
} from '../lib/types';

const LOCALE: Record<Lang, string> = { en: 'en-US', ru: 'ru-RU' };
const PLAN_KEYS = { pro_monthly: 'accountPlanMonthly', pro_yearly: 'accountPlanYearly' } as const;
const STATUS_KEYS = {
  paid: 'accountStatusPaid',
  pending: 'accountStatusPending',
  unpaid: 'accountStatusUnpaid',
} as const;

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInstant(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUtcDate(date: Date, lang: Lang): string {
  return date.toLocaleDateString(LOCALE[lang], {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Turns the `license` object of GET /v1/license/status into what the page shows. */
export function licenceView(license: unknown, lang: Lang): LicenceView {
  if (!isDict(license)) return { kind: 'unknown' };
  switch (license.status) {
    case 'trial':
      return Number.isInteger(license.trialDaysLeft)
        ? { kind: 'trial', daysLeft: license.trialDaysLeft as number }
        : { kind: 'unknown' };
    case 'active': {
      if (license.licenseEndsAt === undefined) return { kind: 'lifetime' };
      const until = parseInstant(license.licenseEndsAt);
      return until ? { kind: 'active', until: formatUtcDate(until, lang) } : { kind: 'unknown' };
    }
    case 'expired':
      return { kind: 'expired' };
    default:
      return { kind: 'unknown' };
  }
}

/** Formats kopecks as roubles: 950000 -> "9 500 ₽" (ru), "9,500 ₽" (en). */
export function formatRub(kopecks: number, lang: Lang): string {
  const roubles = kopecks / 100;
  const fractionDigits = kopecks % 100 === 0 ? 0 : 2;
  const number = new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(roubles);
  return `${number} ₽`;
}

/** Plan code -> display name; an unknown code is shown as-is. */
export function planLabel(code: string, lang: Lang): string {
  if (!Object.prototype.hasOwnProperty.call(PLAN_KEYS, code)) return code;
  return t(lang, PLAN_KEYS[code as keyof typeof PLAN_KEYS]);
}

function isOrder(value: unknown): value is AccountOrder {
  return (
    isDict(value) &&
    Number.isSafeInteger(value.invId) &&
    parseInstant(value.createdAt) !== null &&
    typeof value.plan === 'string' &&
    Number.isSafeInteger(value.amountKopecks) &&
    typeof value.status === 'string'
  );
}

function orderStatus(status: string): OrderRow['status'] {
  return status === 'paid' || status === 'pending' || status === 'unpaid' ? status : 'other';
}

function toRow(order: AccountOrder, lang: Lang): OrderRow {
  const status = orderStatus(order.status);
  const statusKey = status === 'other' ? 'accountStatusOther' : STATUS_KEYS[status];
  return {
    invId: order.invId,
    date: formatUtcDate(parseInstant(order.createdAt) as Date, lang),
    plan: planLabel(order.plan, lang),
    amount: formatRub(order.amountKopecks, lang),
    status,
    statusLabel: t(lang, statusKey),
  };
}

/**
 * Turns the body of GET /v1/billing/orders into table rows.
 * Returns null when the payload does not match the contract, so the page
 * shows an error instead of an empty history.
 */
export function orderRows(data: unknown, lang: Lang): OrderRow[] | null {
  if (!isDict(data) || !Array.isArray(data.orders)) return null;
  const orders: unknown[] = data.orders;
  if (!orders.every(isOrder)) return null;
  return orders.map((order) => toRow(order, lang));
}

const RECORD_STATUSES: readonly AutoRenewRecord['status'][] = ['active', 'past_due', 'cancelled'];
const PAST_DUE_REASONS: readonly AutoRenewPastDueReason[] = ['failures', 'price_changed', 'plan_unavailable', 'expired'];
const CANCEL_REASONS: readonly AutoRenewCancelReason[] = ['user', 'superseded', 'plan_switched'];

function isRecordStatus(value: unknown): value is AutoRenewRecord['status'] {
  return RECORD_STATUSES.some((status) => status === value);
}

function isKopecks(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function pastDueReason(stopReason: string | null): AutoRenewPastDueReason {
  return PAST_DUE_REASONS.find((reason) => reason === stopReason) ?? 'other';
}

function cancelReason(stopReason: string | null): AutoRenewCancelReason {
  return CANCEL_REASONS.find((reason) => reason === stopReason) ?? 'other';
}

/**
 * Turns the `autoRenew` value of GET /v1/billing/autorenew into what the page shows.
 * `null` means no record (auto-renewal is off). Returns null when the record does not
 * match the contract, so the page shows an error instead of a wrong status.
 */
export function autoRenewView(record: unknown, lang: Lang): AutoRenewView | null {
  if (record === null) return { kind: 'off' };
  if (!isDict(record)) return null;
  const { status, plan, amountKopecks, nextChargeAt, chargeInFlight, stopReason } = record;
  if (!isRecordStatus(status) || typeof plan !== 'string' || !isKopecks(amountKopecks)) return null;
  if (typeof chargeInFlight !== 'boolean') return null;
  if (stopReason !== null && typeof stopReason !== 'string') return null;
  const next = parseInstant(nextChargeAt);
  if (nextChargeAt !== null && next === null) return null;

  switch (status) {
    case 'active':
      return {
        kind: 'active',
        amount: formatRub(amountKopecks, lang),
        plan: planLabel(plan, lang),
        next: next ? formatUtcDate(next, lang) : null,
        inFlight: chargeInFlight,
      };
    case 'past_due':
      return { kind: 'past_due', reason: pastDueReason(stopReason), inFlight: chargeInFlight };
    case 'cancelled':
      return { kind: 'cancelled', reason: cancelReason(stopReason), inFlight: chargeInFlight };
  }
}
