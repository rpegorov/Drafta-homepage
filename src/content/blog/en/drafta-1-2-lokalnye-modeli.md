---
title: "Drafta 1.2: local models, model selection, and calculator"
description: "Drafta 1.2 connects local models via LM Studio and Ollama, lets you choose a model for each provider, adds OpenCode Zen and a built-in calculator."
lang: "en"
slug: "drafta-1-2-lokalnye-modeli"
date: "2026-09-27"
published: "2026-09-27T18:00:00+03:00"
updated: "2026-09-28"
draftaId: "4E78FB11-4904-4CA9-A1EC-978FAA3BFDF1"
tags: []
machineTranslated: true
translation:
  sourceHash: "080f57b49b0239129bf8e9a190527a561347df4778acbe4aacf5ae2962b08639"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-09-28T10:32:53.428Z"
---

In 1.2, AI in Drafta is no longer tied to a single provider and a single model. The main thing: you can now work with a model on your own Mac, without keys and without sending text to the cloud.

## Local models

The new Local provider works with any OpenAI-compatible server: LM Studio, Ollama, llama.cpp. No key is needed, and the text never leaves your computer. The Test connection button shows which models are available on the server.

I measured on an M4 Max with Qwen 3.5:

| Model | First word of the suggestion | Generation |
|---|---|---|
| Qwen3.5-4B, MLX 4-bit | 0.13–0.16 s | ~116 tokens/s |
| Qwen3.5-9B, MLX 4-bit | 0.22–0.24 s | ~67 tokens/s |

For ghost text, 4B is enough: the suggestion appears almost immediately. 9B is better for editing text and mermaid diagrams via ⌘J.

> [!TIP]
> By default, Qwen 3.5 models "think" first, and LM Studio does not pass the parameters that turn this off. Drafta handles this itself: with the reasoning level set to Off, the suggestion arrives immediately, and the model's reasoning does not end up in the text.

## Your own model for each task

- **Model selection** is available for every provider: Anthropic, OpenAI, DeepSeek, Local, OpenCode Zen. The list is pulled from the server, and the name can be entered manually.
- **The assistant and ghost text are configured separately.** For example, Claude for editing via ⌘J and a small local model for instant suggestions.
- **Reasoning level** for each role: Off, Minimal, Low, Medium, High. The default is Off: fast and no more expensive than before. Drafta itself translates the choice into the parameter for the required provider; GPT, Gemini, Claude, and DeepSeek all have different ones.

## OpenCode Zen

The opencode.ai gateway with an inexpensive catalog of models: Claude, GPT, Gemini, DeepSeek, Qwen, GLM, Kimi, and free ones. You paste in the Zen key, and all supported models appear in the list. For each one, Drafta itself selects the required address and request format.

## Calculator in the line

You type `1250*12*0,87=`, and the result appears immediately. Tab or Enter inserts it.

- Operations `+ − × ÷ ^`, parentheses, percentages (`15% от 2400=`, `2400-15%=`), `sqrt`, `round`, `min`, `max`.
- Decimal comma: however you enter it, that's how it will output it.
- In code, formulas, and links, the calculator stays silent.

While you're typing an expression, ghost text does not make suggestions: only the calculator computes, accurately and without a model. I made this decision after measuring. Qwen 9B laid out a rent calculation step by step correctly, but in the final line it named a number that was not in its own calculation.

## Fixed

- The Accept button in the ⌘J window could insert the response again and again without closing the window. This happened if the response contained a numbered list.
- Model responses no longer mention the service marker `[insert here]`.

The update will arrive on its own, or download it at [drafta.org](https://drafta.org).
