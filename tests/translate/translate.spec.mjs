// ЗАДАЧА-2.5 — automatic translation (PLAN v2 §11.9), with the owner's decision
// of 2026-09-25: RU → EN only; an English note is never translated to Russian.
// Exporter-level tests run the real CLI with `--translate` and a fake provider
// preloaded in place of global fetch; publisher-level tests drive run.mjs with
// fake exec/readKey/readDefaults.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contractFn, importContract } from '../helpers/contract.mjs';
import { ROOT } from '../helpers/dist.mjs';
import { ID, makeWorld, runExporter, sitePost, slugs } from '../helpers/library.mjs';
import {
  MIN,
  T0,
  cliJson,
  execError,
  isCli,
  isPublish,
  makeClock,
  makeExec,
  makeHome,
  makeNotify,
  runPublisher,
} from '../helpers/publisher.mjs';

const FAKE_PROVIDER = join(ROOT, 'tests/helpers/fake-provider.mjs');
const SEGMENT = 'scripts/translate/segment.mjs';
const SECRET = 'sk-ant-api03-TEST-SECRET-0123456789';
const RU_POST = { title: 'Привет из Drafta', slug: 'privet', lang: 'ru', url: 'https://drafta.org/ru/blog/privet/' };
const EN_FILE = 'src/content/blog/en/privet.md';
const RU_FILE = 'src/content/blog/ru/privet.md';

const cleanups = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()();
});
function world(opts) {
  const w = makeWorld(opts);
  cleanups.push(w.cleanup);
  return w;
}
function home() {
  const h = makeHome();
  cleanups.push(h.cleanup);
  return h;
}

let runNo = 0;
/** One exporter run with --translate against the fake provider; returns its requests too. */
function translateRun(w, mode = 'echo') {
  const log = join(w.home, `provider-${(runNo += 1)}.log`);
  const env = { DRAFTA_AI_PROVIDER: 'anthropic', DRAFTA_AI_KEY: 'sk-ant-fake', FAKE_PROVIDER_MODE: mode, FAKE_PROVIDER_LOG: log };
  const r = runExporter(w, ['--commit', '--translate'], { env, preload: FAKE_PROVIDER });
  const requests = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  return { ...r, requests };
}

const fences = (md) => (md.match(/^(```|~~~)/gm) ?? []).length;
const attachmentLinks = (md) => (md.match(/\]\(\.\/privet\/[^)]+\)/g) ?? []).length;

/** Publisher fakes for the macOS side: `defaults` and the keychain. */
function macFakes({ keyError } = {}) {
  const readDefaults = vi.fn(async (...args) => {
    const key = args.find((a) => typeof a === 'string' && a.startsWith('ai'));
    if (key === 'aiActiveProvider') return 'anthropic';
    if (key === 'aiUseMockProvider') return '0';
    return { aiActiveProvider: 'anthropic', aiUseMockProvider: false };
  });
  const readKey = vi.fn(async () => {
    if (keyError) throw keyError;
    return SECRET;
  });
  const onMac = (call) => {
    if (/\bdefaults\b.*\bread\b/.test(call.line)) return /aiUseMockProvider/.test(call.line) ? '0\n' : 'anthropic\n';
    if (/\bsecurity\b.*find-generic-password/.test(call.line)) {
      if (keyError) throw keyError;
      return `${SECRET}\n`;
    }
    return undefined;
  };
  return { readDefaults, readKey, onMac };
}

describe('ЗАДАЧА-2.5 translation', () => {
  it('[wiring] the publisher runs the exporter with --translate and hands the key over only through the child env', async () => {
    const h = home();
    const clock = makeClock();
    const { readDefaults, readKey, onMac } = macFakes();
    const published = cliJson({ created: [RU_POST], committed: true, sha: 'abc1234', pushed: true, translated: [{ slug: 'privet', from: 'ru', to: 'en', cached: false }], translationDeferred: [] });
    const { exec, calls } = makeExec(clock, (call) => onMac(call) ?? (isCli(call) ? (isPublish(call) ? published : cliJson()) : undefined));
    const { notify, sent } = makeNotify();
    const { log } = await runPublisher({ home: h, clock, exec, notify, readKey, readDefaults });

    const publish = calls.find(isPublish);
    expect(publish, 'the exporter was not run').toBeTruthy();
    expect(publish.line).toContain('--translate');
    expect(publish.line).not.toContain(SECRET);
    expect(publish.opts.env?.DRAFTA_AI_KEY).toBe(SECRET);
    expect(publish.opts.env?.DRAFTA_AI_PROVIDER).toBe('anthropic');
    expect(log).not.toContain(SECRET);
    expect(sent.join('\n')).not.toContain(SECRET);
  });

  it('a Russian-only post gets a machine-translated English twin, and a rerun is served from cache', () => {
    const w = world({ notes: [ID.ruOnly] });
    const first = translateRun(w);
    expect(slugs(first.json.created)).toContain('ru/privet');
    expect(first.json.translated).toContainEqual(expect.objectContaining({ slug: 'privet', from: 'ru', to: 'en', cached: false }));
    expect(first.requests.length).toBeGreaterThan(0);

    const en = w.readSitePost(EN_FILE);
    const ruBody = w.readSitePost(RU_FILE).body;
    expect(en.data.machineTranslated).toBe(true);
    expect(en.data.translation).toMatchObject({ sourceLang: 'ru', provider: 'anthropic' });
    expect(en.data.translation.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(en.data.translation.model).toBeTruthy();
    expect(Number.isNaN(Date.parse(en.data.translation.at))).toBe(false);
    expect(fences(en.body)).toBe(fences(ruBody));
    expect(attachmentLinks(en.body)).toBe(attachmentLinks(ruBody));
    expect(en.body).not.toMatch(/⟦\d+⟧/);

    const enBefore = w.readSite(EN_FILE);
    const second = translateRun(w);
    expect(second.requests).toEqual([]);
    expect(second.json.translated).toContainEqual(expect.objectContaining({ slug: 'privet', cached: true }));
    expect(second.json.committed).toBe(false);
    expect(w.readSite(EN_FILE)).toBe(enBefore);
  });

  it('segment → restore keeps code, attachment://, [[wiki]], the callout marker and $x$ byte for byte', async () => {
    const mod = await importContract(SEGMENT, '2.5');
    const segment = contractFn(mod, ['segment'], SEGMENT, '2.5');
    const restore = contractFn(mod, ['restore'], SEGMENT, '2.5');
    const code = "```js\nconst greeting = 'не переводить';\n```";
    const attachment = 'attachment://07000000-0000-4000-8000-000000000007/pic.png';
    const protectedParts = ['`drafta open`', '$x^2$', '[[Hello world]]', '[!NOTE]', code, attachment];
    const src = [
      '# Что внутри',
      '',
      'Команда `drafta open` и формула $x^2$, ссылка на [[Hello world]].',
      '',
      '> [!NOTE]',
      '> Заметки хранятся в обычных файлах.',
      '',
      code,
      '',
      `![Схема](${attachment})`,
      '',
    ].join('\n');

    const seg = segment(src);
    const text = typeof seg === 'string' ? seg : seg.text;
    expect(typeof text, 'segment() gives no translatable text').toBe('string');
    expect(text).toMatch(/⟦\d+⟧/);
    for (const part of protectedParts) expect(text, `sent to the model: ${part}`).not.toContain(part);
    expect(restore(text, seg)).toBe(src);

    // A "translation" that rewrites every word outside the placeholders.
    const translated = restore(text.replace(/[а-яё]+/gi, 'word'), seg);
    for (const part of protectedParts) expect(translated).toContain(part);
    expect(translated).not.toMatch(/⟦\d+⟧/);
  });

  it('a hand-written English note replaces the machine-translated file (replace-auto) without calling the provider', () => {
    const auto = sitePost({
      title: 'Privet iz Drafta',
      slug: 'privet',
      draftaId: ID.ruOnly,
      extra: `machineTranslated: true\ntranslation:\n  sourceHash: ${'a'.repeat(64)}\n  sourceLang: ru\n  provider: anthropic\n  model: claude-haiku-4-5\n  at: '2026-09-23T10:00:00Z'\n`,
    });
    const w = world({ notes: [ID.ruOnly, ID.enTwinOfRu], site: { [EN_FILE]: auto } });
    const { json, requests } = translateRun(w);
    expect(json.errors).toEqual([]);
    expect(slugs(json.updated)).toContain('en/privet');
    const en = w.readSitePost(EN_FILE);
    expect(en.data.draftaId).toBe(ID.enTwinOfRu);
    expect(en.data.machineTranslated).not.toBe(true);
    expect(requests).toEqual([]);
  });
});

describe('ЗАДАЧА-2.5 translation — failures', () => {
  it('a lost placeholder is retried once; a second failure defers the translation and the original still ships', () => {
    const w = world({ notes: [ID.ruOnly] });
    const { json, requests } = translateRun(w, 'drop-placeholder');
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests.some((r) => /violated/i.test(r.body)), 'the retry does not tell the model what it broke').toBe(true);
    expect(json.translationDeferred).toContainEqual(expect.objectContaining({ slug: 'privet' }));
    expect(slugs(json.created)).toContain('ru/privet');
    expect(w.siteHas(RU_FILE)).toBe(true);
    expect(w.siteHas(EN_FILE)).toBe(false);
  });

  it('offline translation: the original is published and state.json schedules a retry in an hour', async () => {
    const h = home();
    const clock = makeClock();
    const { readDefaults, readKey, onMac } = macFakes();
    const deferred = cliJson({ created: [RU_POST], committed: true, sha: 'abc1234', pushed: true, translated: [], translationDeferred: [{ slug: 'privet', reason: 'offline' }] });
    const { exec } = makeExec(clock, (call) => onMac(call) ?? (isCli(call) ? (isPublish(call) ? deferred : cliJson()) : undefined));
    const { notify, sent } = makeNotify();
    await runPublisher({ home: h, clock, exec, notify, readKey, readDefaults });

    const pending = h.state()?.translations?.pending?.privet;
    expect(pending, 'state.json has no translations.pending.privet').toBeTruthy();
    expect(pending.attempts).toBe(1);
    const nextAfter = typeof pending.nextAfter === 'number' ? pending.nextAfter : Date.parse(pending.nextAfter);
    expect(nextAfter - T0).toBeGreaterThanOrEqual(59 * MIN);
    expect(nextAfter - T0).toBeLessThanOrEqual(63 * MIN);
    expect(sent.some((m) => /без перевода/i.test(m) && m.includes(RU_POST.title)), sent.join(' | ')).toBe(true);
  });

  it('a keychain timeout skips translation with reason "keychain" and still publishes the original', async () => {
    const h = home();
    const clock = makeClock();
    const timeout = execError('security: timed out after 15000 ms', { code: 'ETIMEDOUT', killed: true, signal: 'SIGTERM' });
    const { readDefaults, readKey, onMac } = macFakes({ keyError: timeout });
    const published = cliJson({ created: [RU_POST], committed: true, sha: 'abc1234', pushed: true, translated: [], translationDeferred: [] });
    const { exec, calls } = makeExec(clock, (call) => onMac(call) ?? (isCli(call) ? (isPublish(call) ? published : cliJson()) : undefined));
    const { notify, sent } = makeNotify();
    await runPublisher({ home: h, clock, exec, notify, readKey, readDefaults });

    const publish = calls.find(isPublish);
    expect(publish, 'the original was not published').toBeTruthy();
    expect(publish.opts.env?.DRAFTA_AI_KEY ?? '').toBe('');
    expect(sent.some((m) => /keychain/i.test(m)), sent.join(' | ')).toBe(true);
  });

  it('an English note is never translated into Russian', () => {
    const w = world({ notes: [ID.enOnly] });
    const { json, requests } = translateRun(w);
    expect(slugs(json.created)).toEqual(['en/english-only']);
    expect(w.siteHas('src/content/blog/ru/english-only.md')).toBe(false);
    expect(requests).toEqual([]);
    expect((json.translated ?? []).filter((t) => t.slug === 'english-only')).toEqual([]);
  });
});
