import { describe, expect, it } from 'vitest';
import { formatRub, licenceView, orderRows, planLabel } from '../src/scripts/account-model.ts';

const TRIAL = { status: 'trial', trialDaysLeft: 12 };
const ACTIVE = { status: 'active', licenseEndsAt: '2027-03-01T00:00:00Z' };

describe('licenceView', () => {
  it('shows the days left of a trial', () => {
    expect(licenceView(TRIAL, 'en')).toEqual({ kind: 'trial', daysLeft: 12 });
  });

  it('formats the end of an active licence in UTC, whatever the visitor timezone', () => {
    expect(licenceView(ACTIVE, 'en')).toEqual({ kind: 'active', until: 'March 1, 2027' });
    expect(licenceView({ ...ACTIVE, licenseEndsAt: '2027-02-28T23:30:00Z' }, 'ru')).toEqual({
      kind: 'active',
      until: '28 февраля 2027 г.',
    });
  });

  it('treats an active licence without an end date as lifetime', () => {
    expect(licenceView({ status: 'active' }, 'en')).toEqual({ kind: 'lifetime' });
  });

  it('reports an expired licence', () => {
    expect(licenceView({ status: 'expired' }, 'en')).toEqual({ kind: 'expired' });
  });

  it('falls back to unknown for malformed or unrecognised data', () => {
    expect(licenceView(undefined, 'en')).toEqual({ kind: 'unknown' });
    expect(licenceView(null, 'en')).toEqual({ kind: 'unknown' });
    expect(licenceView([], 'en')).toEqual({ kind: 'unknown' });
    expect(licenceView({ status: 'suspended' }, 'en')).toEqual({ kind: 'unknown' });
    expect(licenceView({ status: 'trial', trialDaysLeft: '12' }, 'en')).toEqual({ kind: 'unknown' });
    expect(licenceView({ status: 'active', licenseEndsAt: 'not a date' }, 'en')).toEqual({ kind: 'unknown' });
  });
});

describe('formatRub', () => {
  it('drops empty kopecks and groups thousands by locale', () => {
    expect(formatRub(950000, 'ru')).toBe('9 500 ₽');
    expect(formatRub(950000, 'en')).toBe('9,500 ₽');
    expect(formatRub(99000, 'en')).toBe('990 ₽');
  });

  it('keeps kopecks when they are not zero', () => {
    expect(formatRub(99050, 'ru')).toBe('990,50 ₽');
    expect(formatRub(99050, 'en')).toBe('990.50 ₽');
    expect(formatRub(5, 'en')).toBe('0.05 ₽');
  });
});

describe('planLabel', () => {
  it('names the known plans in each language', () => {
    expect(planLabel('pro_monthly', 'en')).toBe('Pro — monthly');
    expect(planLabel('pro_yearly', 'ru')).toBe('Pro — год');
  });

  it('returns an unknown code unchanged', () => {
    expect(planLabel('enterprise', 'en')).toBe('enterprise');
    expect(planLabel('constructor', 'ru')).toBe('constructor');
  });
});

describe('orderRows', () => {
  const order = {
    invId: 42,
    createdAt: '2026-10-19T09:12:03Z',
    plan: 'pro_yearly',
    amountKopecks: 950000,
    status: 'paid',
  };

  it('maps orders to formatted rows in the given order', () => {
    const rows = orderRows(
      {
        orders: [order, { ...order, invId: 41, plan: 'pro_monthly', amountKopecks: 99000, status: 'unpaid' }],
      },
      'en',
    );
    expect(rows).toEqual([
      {
        invId: 42,
        date: 'October 19, 2026',
        plan: 'Pro — yearly',
        amount: '9,500 ₽',
        status: 'paid',
        statusLabel: 'Paid',
      },
      {
        invId: 41,
        date: 'October 19, 2026',
        plan: 'Pro — monthly',
        amount: '990 ₽',
        status: 'unpaid',
        statusLabel: 'Not paid',
      },
    ]);
  });

  it('returns an empty list for an empty history', () => {
    expect(orderRows({ orders: [] }, 'ru')).toEqual([]);
  });

  it('labels pending orders', () => {
    const [row] = orderRows({ orders: [{ ...order, status: 'pending' }] }, 'ru');
    expect(row.status).toBe('pending');
    expect(row.statusLabel).toBe('В ожидании');
  });

  it('marks an unrecognised status as other', () => {
    const [row] = orderRows({ orders: [{ ...order, status: 'refunded' }] }, 'en');
    expect(row.status).toBe('other');
    expect(row.statusLabel).toBe('Unknown');
  });

  it('returns null for payloads that do not match the contract', () => {
    expect(orderRows({}, 'en')).toBeNull();
    expect(orderRows({ orders: null }, 'en')).toBeNull();
    expect(orderRows({ orders: {} }, 'en')).toBeNull();
    expect(orderRows(null, 'en')).toBeNull();
    expect(orderRows({ orders: [{ ...order, invId: '42' }] }, 'en')).toBeNull();
    expect(orderRows({ orders: [{ ...order, amountKopecks: 990.5 }] }, 'en')).toBeNull();
    expect(orderRows({ orders: [{ ...order, createdAt: 'yesterday' }] }, 'en')).toBeNull();
    expect(orderRows({ orders: [{ ...order, plan: undefined }] }, 'en')).toBeNull();
  });
});
