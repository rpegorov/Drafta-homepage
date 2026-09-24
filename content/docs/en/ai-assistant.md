---
title: The AI assistant in the editor
description: How to use Drafta's AI assistant (⌘J) — presets, custom prompts, Anthropic, OpenAI and DeepSeek providers, where keys are kept and what data reaches the provider.
sidebar:
  order: 2
---

The assistant works inside the note. It rewrites a selected passage or inserts new text at the
caret. The answer streams straight into the text, and then you accept or reject it.

Drafta does not resell model access. The assistant talks to the provider directly with **your own
API key**.

## Setup

1. Open **Settings → AI**.
2. Under **Provider**, choose the active one: **Claude**, **OpenAI** or **DeepSeek**.
3. Paste the key in that provider's section and press **Save**.
4. Press **Test** to check it. The test sends a tiny request that costs a couple of tokens.

You can switch providers at any time without losing the saved keys.

| Provider | Model |
|---|---|
| Claude (Anthropic) | `claude-haiku-4-5` |
| OpenAI | `gpt-4o-mini` |
| DeepSeek | `deepseek-chat` |

The models were chosen for speed, because the assistant is for quick edits in place.

## Using it

1. Select text to change it, or leave just the caret to insert new text.
2. Press **⌘J**.
3. Pick a preset, or type your own request and press **Enter**.
4. When the answer is ready:

| To | Use |
|---|---|
| Accept | **Accept**, **⌘↩**, or click in the editor |
| Reject | **Reject** or **Esc** |
| Regenerate | **⌘R** |
| Cancel while it streams | **Esc** |

### Presets

| Preset | Needs a selection | What it does |
|---|---|---|
| Improve writing | yes | Improves style and grammar, keeping the language and the Markdown |
| Make shorter | yes | Shortens and keeps the key points |
| Make longer | yes | Expands with detail and examples |
| Fix grammar | yes | Fixes grammar and spelling only |
| Summarize | no | Summarises the selection, or the text above, in 1–3 bullets |
| Continue writing | no | Continues in the same voice |
| Generate diagram | no | Returns a diagram in a ` ```mermaid ` block |
| Custom prompt | no | Follows the request you typed |

## What reaches the provider

A request goes out only when you run one, and only to the provider you selected. Drafta's servers
are not involved, and there is no telemetry.

**Sent:**
- the preset's instruction, or your request;
- the note title;
- the selected text;
- up to two paragraphs before and after the selection, about 32,000 characters in total at most.

**Not sent:** the rest of the note, other notes, attachments, tags and metadata.

> [!IMPORTANT]
> The provider receives that passage as plain text. Library encryption does not extend to AI
> requests, so do not run the assistant on text that must not reach a third party.

## Where keys are kept

Keys are kept in the macOS Keychain and read only at the moment of a request. The app's logs mask
them.

- **View:** Settings shows only the first and last few characters.
- **Change:** use **Replace**.
- **Delete:** use **Remove**.

## Errors

| Message | What to do |
|---|---|
| *No API key set for …* | Add a key in Settings → AI |
| *Invalid API key* | Check the key or replace it |
| *Rate limited — try again in N s* | The provider is throttling requests. Wait, then retry |
| *Server returned …* | The provider returned an error. Its response is shown in the message |

## Limits

- Answers are capped at 2000 tokens, so rewrite very long passages in parts.
- The model cannot be changed from the interface yet.

<!-- TODO(audit 24.09): until A1 is fixed, ⌘J in the last paragraph of a note crashes the app, and
     non-ASCII replies can lose characters (A3). Publish after the fixes. -->
