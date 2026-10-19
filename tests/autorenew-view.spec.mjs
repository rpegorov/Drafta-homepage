import { describe, expect, it } from 'vitest';
import { autoRenewView } from '../src/scripts/account-model.ts';

const ACTIVE = {
  status: 'active',
  plan: 'pro_monthly',
  amountKopecks: 99000,
  nextChargeAt: '2026-11-28T09:00:00Z',
  chargeInFlight: false,
  stopReason: null,
};

describe('autoRenewView', () => {
  it('reports no record as off', () => {
    expect(autoRenewView(null, 'en')).toEqual({ kind: 'off' });
  });

  it('formats an active record with the next charge date in UTC', () => {
    expect(autoRenewView(ACTIVE, 'en')).toEqual({
      kind: 'active',
      amount: '990 ₽',
      plan: 'Pro — monthly',
      next: 'November 28, 2026',
      inFlight: false,
    });
  });

  it('formats the active record in Russian', () => {
    const view = autoRenewView({ ...ACTIVE, nextChargeAt: '2026-11-27T23:30:00Z' }, 'ru');
    expect(view).toMatchObject({ kind: 'active', next: '27 ноября 2026 г.' });
  });

  it('shows no next date when the server has none', () => {
    expect(autoRenewView({ ...ACTIVE, nextChargeAt: null }, 'en')).toMatchObject({ kind: 'active', next: null });
  });

  it('marks an active record whose charge is in progress', () => {
    expect(autoRenewView({ ...ACTIVE, chargeInFlight: true }, 'en')).toMatchObject({ inFlight: true });
  });

  it('maps past_due stop reasons', () => {
    for (const reason of ['failures', 'price_changed', 'plan_unavailable', 'expired']) {
      expect(autoRenewView({ ...ACTIVE, status: 'past_due', stopReason: reason, nextChargeAt: null }, 'en')).toEqual({
        kind: 'past_due',
        reason,
        inFlight: false,
      });
    }
  });

  it('maps cancelled stop reasons, including plan_switched', () => {
    for (const reason of ['user', 'superseded', 'plan_switched']) {
      expect(autoRenewView({ ...ACTIVE, status: 'cancelled', stopReason: reason, nextChargeAt: null }, 'ru')).toEqual({
        kind: 'cancelled',
        reason,
        inFlight: false,
      });
    }
  });

  it('keeps inFlight on past_due and cancelled records', () => {
    expect(autoRenewView({ ...ACTIVE, status: 'cancelled', stopReason: 'user', chargeInFlight: true }, 'en')).toMatchObject({
      kind: 'cancelled',
      inFlight: true,
    });
    expect(autoRenewView({ ...ACTIVE, status: 'past_due', stopReason: 'expired', chargeInFlight: true }, 'en')).toMatchObject({
      kind: 'past_due',
      inFlight: true,
    });
  });

  it('falls back to other for a missing or unmapped stop reason', () => {
    expect(autoRenewView({ ...ACTIVE, status: 'past_due', stopReason: null }, 'en')).toMatchObject({ reason: 'other' });
    expect(autoRenewView({ ...ACTIVE, status: 'cancelled', stopReason: 'failures' }, 'en')).toMatchObject({ reason: 'other' });
  });

  it('returns null for bodies that do not match the contract', () => {
    expect(autoRenewView(undefined, 'en')).toBeNull();
    expect(autoRenewView('active', 'en')).toBeNull();
    expect(autoRenewView([], 'en')).toBeNull();
    expect(autoRenewView({ ...ACTIVE, status: 'none' }, 'en')).toBeNull();
    expect(autoRenewView({ ...ACTIVE, plan: 42 }, 'en')).toBeNull();
    expect(autoRenewView({ ...ACTIVE, amountKopecks: 0 }, 'en')).toBeNull();
    expect(autoRenewView({ ...ACTIVE, amountKopecks: 990.5 }, 'en')).toBeNull();
    expect(autoRenewView({ ...ACTIVE, chargeInFlight: 'yes' }, 'en')).toBeNull();
    expect(autoRenewView({ ...ACTIVE, stopReason: 7 }, 'en')).toBeNull();
    expect(autoRenewView({ ...ACTIVE, stopReason: undefined }, 'en')).toBeNull();
    expect(autoRenewView({ ...ACTIVE, nextChargeAt: 'soon' }, 'en')).toBeNull();
    expect(autoRenewView({ ...ACTIVE, nextChargeAt: undefined }, 'en')).toBeNull();
  });
});
