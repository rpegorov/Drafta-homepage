// ЗАДАЧА-1.0 — the composition root of the site: src/lib/config.ts is the one
// place that knows the API, and every script that talks to the API reaches it
// through an import, not through window (PLAN v2 §5 "Швы").
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resetScripts, runScript } from './helpers/browser.mjs';
import { ROOT } from './helpers/dist.mjs';

const CONFIG = join(ROOT, 'src/lib/config.ts');
const API_SCRIPTS = [
  'src/scripts/forms.ts',
  'src/scripts/plans.ts',
  'src/scripts/pages/login.ts',
  'src/scripts/pages/register.ts',
  'src/scripts/pages/verify.ts',
  'src/scripts/pages/checkout.ts',
  'src/scripts/pages/checkout-success.ts',
  'src/scripts/pages/account.ts',
];
const ALL_SCRIPTS = [
  'src/scripts/lang.ts',
  'src/scripts/nav.ts',
  'src/scripts/session.ts',
  'src/scripts/session-nav.ts',
  'src/scripts/account-model.ts',
  ...API_SCRIPTS,
];
const ACCOUNT_PAGE_SCRIPT = 'src/scripts/pages/account.ts';
const ACCOUNT_MARKUP = 'src/components/AccountPage.astro';
const ACCOUNT_HOOKS = [
  'data-licence',
  'data-licence-text',
  'data-licence-error',
  'data-licence-retry',
  'data-account-email',
  'data-account-verified',
  'data-orders',
  'data-orders-table',
  'data-orders-empty',
  'data-orders-error',
  'data-orders-retry',
  'data-logout',
];

function resolveImport(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  return [base, `${base}.ts`, `${base}.mjs`, `${base}.js`, join(base, 'index.ts')].find((f) => existsSync(f) && statSync(f).isFile());
}

/** Follows relative imports from `entry`; true when src/lib/config.ts is reached. */
function reachesConfig(entry, seen = new Set()) {
  if (seen.has(entry)) return false;
  seen.add(entry);
  if (entry === CONFIG) return true;
  const src = readFileSync(entry, 'utf8');
  const specs = [...src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)]
    .map((m) => m[1] || m[2]);
  return specs.some((spec) => {
    const file = resolveImport(entry, spec);
    return file ? reachesConfig(file, seen) : false;
  });
}

describe('ЗАДАЧА-1.0 composition root', () => {
  it('[wiring] src/lib/config.ts exports api, endpoints, planFallback and unwiredCapabilities with real values', async () => {
    resetScripts();
    const config = await runScript('src/lib/config.ts', 'ЗАДАЧА-1.0');
    expect(config.api).toBe('https://api.drafta.org');
    for (const key of ['plans', 'register', 'login', 'verify', 'subscribe']) {
      expect(config.endpoints?.[key], `endpoints.${key}`).toMatch(/^\/v1\//);
    }
    const byCode = Object.fromEntries((config.planFallback ?? []).map((p) => [p.code, p.priceCents]));
    expect(byCode).toEqual({ pro_monthly: 999, pro_yearly: 9588 });
    expect(Array.isArray(config.unwiredCapabilities), 'unwiredCapabilities must be an array').toBe(true);
  });

  it('[+] every script exists, and every script that talks to the API reaches config.ts through imports', () => {
    const missing = ALL_SCRIPTS.filter((rel) => !existsSync(join(ROOT, rel)));
    expect(missing, 'scripts named by the ЗАДАЧА-1.0 contract').toEqual([]);
    const unwired = API_SCRIPTS.filter((rel) => !reachesConfig(join(ROOT, rel)));
    expect(unwired, 'scripts that do not import src/lib/config.ts (directly or transitively)').toEqual([]);
  });

  it('[-] no script takes the API base or endpoints from window.DRAFTA', () => {
    const offenders = ALL_SCRIPTS
      .filter((rel) => existsSync(join(ROOT, rel)))
      .filter((rel) => /window\s*\.\s*DRAFTA\s*(\.\s*|\[\s*['"])(api|endpoints)\b/.test(readFileSync(join(ROOT, rel), 'utf8')));
    expect(ALL_SCRIPTS.every((rel) => existsSync(join(ROOT, rel))), 'scripts missing — see the previous test').toBe(true);
    expect(offenders).toEqual([]);
  });

  it('[-] nothing is declared but unwired, apart from the OWNER fields of the legal pages', async () => {
    resetScripts();
    const { unwiredCapabilities } = await runScript('src/lib/config.ts', 'ЗАДАЧА-1.0');
    expect(Array.isArray(unwiredCapabilities), 'unwiredCapabilities must be an array').toBe(true);
    const notOwner = unwiredCapabilities.filter((entry) => !/owner/i.test(JSON.stringify(entry)));
    expect(notOwner).toEqual([]);
  });
});

describe('account page wiring (source text, no rendered dist)', () => {
  const scriptSource = () => readFileSync(join(ROOT, ACCOUNT_PAGE_SCRIPT), 'utf8');
  const markupSource = () => readFileSync(join(ROOT, ACCOUNT_MARKUP), 'utf8');

  it('[+] every relative import of the account script resolves to an existing file', () => {
    const specs = [...scriptSource().matchAll(/from\s*['"](\.{1,2}\/[^'"]+)['"]|import\s*['"](\.{1,2}\/[^'"]+)['"]/g)]
      .map((m) => m[1] || m[2]);
    expect(specs.length).toBeGreaterThan(0);
    const missing = specs.filter((spec) => !resolveImport(join(ROOT, ACCOUNT_PAGE_SCRIPT), spec));
    expect(missing, 'unresolved imports in account.ts').toEqual([]);
  });

  it('[+] every DOM hook the account script queries exists in AccountPage.astro', () => {
    const script = scriptSource();
    const markup = markupSource();
    const unqueried = ACCOUNT_HOOKS.filter((hook) => !script.includes(`'${hook}'`));
    const missingInMarkup = ACCOUNT_HOOKS.filter((hook) => !new RegExp(`\\b${hook}\\b`).test(markup));
    expect(unqueried, 'hooks listed for the account page but not used by account.ts').toEqual([]);
    expect(missingInMarkup, 'hooks used by account.ts but absent from AccountPage.astro').toEqual([]);
  });

  it('[+] the header account link hook is set by session-nav and rendered by Header.astro', () => {
    const nav = readFileSync(join(ROOT, 'src/scripts/session-nav.ts'), 'utf8'); // lint-allow: test-reads-source hook names are the only contract between the Astro markup and the scripts
    const header = readFileSync(join(ROOT, 'src/components/Header.astro'), 'utf8');
    expect(nav).toContain("'[data-account-link]'");
    expect(header).toMatch(/data-account-link[^>]*\bhidden\b/);
  });

  it('[+] Base.astro loads the session-nav script next to nav.ts', () => {
    const base = readFileSync(join(ROOT, 'src/layouts/Base.astro'), 'utf8');
    expect(base).toContain("import '../scripts/session-nav.ts';");
  });
});
