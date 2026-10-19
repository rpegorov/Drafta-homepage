/* /checkout/success/ and /ru/checkout/success/. The redirect that lands here
   is not proof of payment, so nothing from the query string is read: the
   licence state comes only from the license status endpoint. */
import { api, endpoints } from '../../lib/config';
import { normalizeLang, t } from '../../i18n';
import { accessToken } from '../session';

const LANG = normalizeLang(document.documentElement.lang);
const ACTIVE_STATUS = 'active';
const LICENSE_KEY = 'license';

const messageEl = document.getElementById('licence-message');
const loginEl = document.getElementById('licence-login');

function say(text: string): void { if (messageEl) messageEl.textContent = text; }

function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(LANG);
}

function activeMessage(data: Record<string, unknown>): string {
  const until = formatDate(data.licenseEndsAt);
  return until
    ? t(LANG, 'checkoutSuccessActiveUntil').split('{value}').join(until)
    : t(LANG, 'checkoutSuccessActive');
}

async function fetchLicense(access: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(api + endpoints.license, {
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + access },
  });
  if (!response.ok) return null;
  const data: unknown = await response.json();
  const license = data && typeof data === 'object' ? (data as Record<string, unknown>)[LICENSE_KEY] : null;
  return license && typeof license === 'object' ? license as Record<string, unknown> : null;
}

async function showLicence(): Promise<void> {
  const access = accessToken();
  if (!access) {
    say(t(LANG, 'checkoutSuccessNeedsSignIn'));
    if (loginEl) loginEl.hidden = false;
    return;
  }
  try {
    const license = await fetchLicense(access);
    if (!license) { say(t(LANG, 'checkoutSuccessUnreachable')); return; }
    const active = license.licensed === true && license.status === ACTIVE_STATUS;
    say(active ? activeMessage(license) : t(LANG, 'checkoutSuccessPending'));
  } catch {
    say(t(LANG, 'checkoutSuccessUnreachable'));
  }
}

void showLicence();
