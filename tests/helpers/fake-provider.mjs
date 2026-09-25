// Preloaded into the exporter process with `node --import`: replaces the
// network boundary (global fetch) with a scripted AI provider, so the real CLI
// → translate → provider path runs without a key or a connection.
//
// FAKE_PROVIDER_MODE:
//   echo             — "translates" by transliterating Cyrillic to Latin, keeping
//                      every ⟦n⟧ placeholder, heading and list line in place;
//   drop-placeholder — same, but drops the first ⟦n⟧ from every answer;
//   offline          — every request throws like undici does without network.
// FAKE_PROVIDER_LOG — file that gets one JSON line {url, body} per request.
import { appendFileSync } from 'node:fs';

const MODE = process.env.FAKE_PROVIDER_MODE ?? 'echo';
const LOG = process.env.FAKE_PROVIDER_LOG;

const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function transliterate(text) {
  return text.replace(/[а-яё]/gi, (ch) => {
    const lat = CYR[ch.toLowerCase()] ?? ch;
    return ch === ch.toLowerCase() ? lat : lat.charAt(0).toUpperCase() + lat.slice(1);
  });
}

function lastUserText(body) {
  const user = (body.messages ?? []).filter((m) => m.role === 'user').at(-1);
  if (!user) return '';
  if (typeof user.content === 'string') return user.content;
  return user.content.map((part) => part.text ?? '').join('');
}

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url ?? String(input);
  const raw = init.body ? String(init.body) : '';
  if (LOG) appendFileSync(LOG, `${JSON.stringify({ url, body: raw })}\n`);
  if (MODE === 'offline') throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND api.anthropic.com') });

  let out = transliterate(lastUserText(JSON.parse(raw || '{}')));
  if (MODE === 'drop-placeholder') out = out.replace(/⟦\d+⟧/, '');
  const payload = /anthropic/.test(url)
    ? { id: 'msg_fake', type: 'message', role: 'assistant', content: [{ type: 'text', text: out }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 100 } }
    : { id: 'chatcmpl-fake', choices: [{ index: 0, message: { role: 'assistant', content: out }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 100 } };
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
};
