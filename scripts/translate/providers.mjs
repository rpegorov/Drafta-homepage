// The three AI providers Drafta offers (PLAN v2 §11.9 "Факты из кода"),
// spoken to with plain fetch: Anthropic Messages API and the OpenAI-compatible
// chat/completions of OpenAI and DeepSeek. Default models are Drafta's own
// `AIProviderID.defaultModel` — the app has no model setting.

const ANTHROPIC_VERSION = '2023-06-01';
const TEMPERATURE = 0;

function anthropicRequest({ key, model, system, text, maxTokens }) {
  return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION },
    body: { model, max_tokens: maxTokens, temperature: TEMPERATURE, system, messages: [{ role: 'user', content: text }] },
  };
}

function anthropicAnswer(json) {
  const text = (json.content ?? []).filter((part) => part.type === 'text').map((part) => part.text).join('');
  return {
    text,
    truncated: json.stop_reason === 'max_tokens',
    usage: { inputTokens: json.usage?.input_tokens ?? 0, outputTokens: json.usage?.output_tokens ?? 0 },
  };
}

function chatCompletionsRequest(baseUrl) {
  return ({ key, model, system, text, maxTokens }) => ({
    url: `${baseUrl}/chat/completions`,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: {
      model,
      max_tokens: maxTokens,
      temperature: TEMPERATURE,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
    },
  });
}

function chatCompletionsAnswer(json) {
  const choice = json.choices?.[0];
  return {
    text: choice?.message?.content ?? '',
    truncated: choice?.finish_reason === 'length',
    usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 },
  };
}

const PROVIDERS = {
  anthropic: { defaultModel: 'claude-haiku-4-5', request: anthropicRequest, answer: anthropicAnswer },
  openai: { defaultModel: 'gpt-4o-mini', request: chatCompletionsRequest('https://api.openai.com/v1'), answer: chatCompletionsAnswer },
  deepseek: { defaultModel: 'deepseek-chat', request: chatCompletionsRequest('https://api.deepseek.com/v1'), answer: chatCompletionsAnswer },
};

export const PROVIDER_IDS = Object.freeze(Object.keys(PROVIDERS));

/** @returns {{defaultModel: string, request: Function, answer: Function} | null} */
export function providerFor(id) {
  return PROVIDERS[id] ?? null;
}
