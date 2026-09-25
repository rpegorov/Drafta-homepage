/* schema.org SoftwareApplication for the landing (reference: c497677, plus the
   author the brandbook's drafta.org migration asks for). Offers are built from
   planFallback — the same list the pricing cards fall back to — so the prices
   here cannot drift from the site's own. */

import { planFallback, releases } from '../../lib/config';
import { localePath } from '../../lib/lang';
import type { Lang, Plan } from '../../lib/types';

const CENTS_PER_DOLLAR = 100;
const CURRENCY = 'USD';
const BILLING_DURATION: Record<string, string> = { monthly: 'P1M', yearly: 'P1Y' };
const OFFER_NAME: Record<Lang, Record<string, string>> = {
  en: { monthly: 'Monthly', yearly: 'Annual' },
  ru: { monthly: 'На месяц', yearly: 'На год' },
};
/* Monthly first, as in the reference markup. */
const OFFER_ORDER = ['monthly', 'yearly'];

const DESCRIPTION: Record<Lang, string> = {
  en: 'A native macOS Markdown editor for programmers: CodeMirror 6, 50+ languages, Mermaid and KaTeX preview, notebooks, tags, revision history, an AI assistant and a built-in MCP server. Notes stay plain .md files on your Mac; sync is end-to-end encrypted.',
  ru: 'Нативный редактор Markdown для macOS для программистов: CodeMirror 6, 50+ языков, предпросмотр Mermaid и KaTeX, блокноты, теги, история ревизий, AI-ассистент и встроенный MCP-сервер. Заметки остаются обычными файлами .md на вашем Mac; синхронизация зашифрована end-to-end.',
};

function price(plan: Plan): string {
  return (plan.priceCents / CENTS_PER_DOLLAR).toFixed(2);
}

function offer(plan: Plan, site: URL, lang: Lang) {
  const amount = price(plan);
  return {
    '@type': 'Offer',
    name: OFFER_NAME[lang][plan.billing],
    price: amount,
    priceCurrency: CURRENCY,
    url: new URL(`${localePath('/checkout/', lang)}?plan=${plan.code}`, site).href,
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: amount,
      priceCurrency: CURRENCY,
      billingDuration: BILLING_DURATION[plan.billing],
    },
  };
}

export function softwareApplication(lang: Lang, site: URL): Record<string, unknown> {
  const plans = OFFER_ORDER
    .map((billing) => planFallback.find((plan) => plan.billing === billing))
    .filter((plan): plan is Plan => plan !== undefined);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Drafta',
    url: new URL(localePath('/', lang), site).href,
    inLanguage: lang,
    description: DESCRIPTION[lang],
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Markdown editor',
    operatingSystem: 'macOS 26 or later',
    softwareVersion: '1.0',
    downloadUrl: releases,
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    image: new URL('/og.png', site).href,
    author: { '@type': 'Person', name: 'Rostislav Egorov', url: 'https://craftzman.ru' },
    offers: plans.map((plan) => offer(plan, site, lang)),
  };
}
