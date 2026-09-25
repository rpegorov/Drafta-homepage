// A rejected push retried by run.mjs (PLAN v2 §11.9 п. 5–6, review §11.10):
// the translation made and committed in attempt 1 is not redone in attempt 2
// (the exporter then reports it as nothing new), yet it was paid for — its
// characters count against the day's quota and the owner is told it was
// translated once the retry pushes it.
// The quota is observed through the contract run.mjs hands the exporter: the
// next run of the same day gets DRAFTA_TRANSLATE_MAX_CHARS = daily limit − spent.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST, cliJson, execError, isCli, isPublish, makeClock, makeExec, makeHome, makeNotify, runPublisher } from '../helpers/publisher.mjs';

const REJECTED = ' ! [rejected]        site-publisher-test -> site-publisher-test (fetch first)\nerror: failed to push some refs';
const CHARS = 1500;
const PER_DAY = 2000;
const TRANSLATION = { slug: POST.slug, from: 'en', to: 'ru', cached: false, provider: 'anthropic', model: 'fake-model', chars: CHARS, url: 'https://drafta.org/ru/blog/hello-world/' };

const homes = [];
afterEach(() => {
  while (homes.length) homes.pop().cleanup();
});

const readDefaults = vi.fn(async (...args) => (args.includes('aiUseMockProvider') ? '0' : 'anthropic'));
const readKey = vi.fn(async () => 'sk-ant-fake');
const env = { PUBLISHER_TRANSLATE_MAX_CHARS_PER_DAY: String(PER_DAY) };

/**
 * Attempt 1 translates and commits, its push is rejected — the exporter's
 * contract: the translation is deferred as `git` and carries its paid record;
 * attempt 2 finds the translation already committed and reports it cached.
 */
function rejectedThenPushed() {
  let publishes = 0;
  return (call) => {
    if (/rev-parse/.test(call.line)) return 'abc1234\n';
    if (!isCli(call)) return undefined;
    if (!isPublish(call)) return cliJson();
    publishes += 1;
    if (publishes === 1) {
      const { cached: _cached, ...paid } = TRANSLATION;
      throw execError('push rejected', {
        code: 1,
        stdout: cliJson({
          created: [POST],
          committed: true,
          sha: 'abc1234',
          pushed: false,
          translated: [],
          translationDeferred: [{ ...paid, reason: 'git', sourceHash: 'hash-1' }],
          translationChars: CHARS,
          errors: [{ title: 'git', message: REJECTED }],
        }),
      });
    }
    const cached = { slug: TRANSLATION.slug, from: TRANSLATION.from, to: TRANSLATION.to, cached: true };
    return cliJson({ unchanged: [POST], committed: false, sha: 'abc1234', pushed: true, translated: [cached], translationDeferred: [], translationChars: 0 });
  };
}

describe('review — translation survives a push retry', () => {
  it('characters translated in the rejected attempt count against the day, and the owner hears about the translation', async () => {
    const h = makeHome();
    homes.push(h);
    const clock = makeClock();
    const first = makeExec(clock, rejectedThenPushed());
    const { notify, sent } = makeNotify();

    const { code } = await runPublisher({ home: h, clock, exec: first.exec, notify, readKey, readDefaults, env });

    expect(code).toBe(0);
    expect(first.calls.filter(isPublish), 'the rejected push was not retried').toHaveLength(2);
    expect(sent.some((m) => /Переведено/.test(m)), sent.join(' | ')).toBe(true);

    // Same day, next run: the budget left for the exporter is what attempt 1 did not spend.
    const second = makeExec(clock, (call) => (isCli(call) ? cliJson({ committed: false, pushed: true }) : undefined));
    await runPublisher({ home: h, clock, exec: second.exec, notify: makeNotify().notify, readKey, readDefaults, env });
    const publish = second.calls.find(isPublish);
    expect(publish, 'the second run did not run the exporter').toBeTruthy();
    expect(publish.opts.env?.DRAFTA_TRANSLATE_MAX_CHARS).toBe(String(PER_DAY - CHARS));
  });
});
