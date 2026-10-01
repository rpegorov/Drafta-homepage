---
title: "Emoji in Drafta: colon instead of a palette"
description: "How to insert emoji into Drafta from the keyboard: a colon and a couple of letters of the name, like on GitHub. The note keeps the symbol itself, not the code."
lang: "en"
slug: "drafta-emoji-shortcodes"
date: "2026-09-29"
published: "2026-09-29T12:00:00+03:00"
updated: "2026-10-01"
draftaId: "7B2261E1-3CE8-463D-A834-F2B21ADEA813"
tags: []
machineTranslated: true
translation:
  sourceHash: "136aa92b451c7c031740cc5c6dd5ad94e77172d2b843953ba40eb786b20abb47"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-10-01T16:55:16.253Z"
---

To insert an emoji into a note, you don't need to open the system palette and scroll through a table. In Drafta, it's enough to type a colon and a couple of letters of the name: `:tad` — and the menu already shows 🎉. How it works and what it doesn't have — below.

## How to insert

1. Type `:` and at least two characters of the name: `:fire`, `:rocket`, `:thinking`.
2. A menu will open: the code on the left, the emoji itself on the right.
3. Select an item with the arrows and confirm with Enter.

The **character** will be inserted into the text, not the code `:fire:`. That's why the note remains ordinary Markdown: in any other app you'll see 🔥, and no renderer that knows about shortcodes is needed for this.

| You type | You get |
|---|---|
| `:smile` | 😄 |
| `:thinking` | 🤔 |
| `:+1` | 👍 |
| `:fire` | 🔥 |
| `:rocket` | 🚀 |
| `:white_check_mark` | ✅ |
| `:warning` | ⚠️ |
| `:bug` | 🐛 |
| `:tada` | 🎉 |

The names are English and match GitHub shortcodes, so if you're used to them, you won't have to learn anything anew.

## When the menu doesn't open

The menu doesn't trigger on just any colon:

- you need at least **two characters** after `:` — otherwise it would pop up on every `::` in code and on times like `12:`;
- the colon must be **at the beginning of a line or after a space or opening parenthesis**, so the menu won't open in the middle of a word or address;
- Latin letters, digits, `_`, `+`, and `-` are allowed: `:+1`, `:100`, `:white_check_mark`.

## Which emojis are available

The list has about 190 emojis, not the entire Unicode table: faces and gestures, heart, fire and stars, marks like ✅ and ❌, tools and office, weather, animals, food. These are what are most often needed in notes; this way the menu stays short and the editor stays lightweight.

> [!TIP]
> If the emoji you need isn't in the list, open the macOS system palette: Ctrl+Cmd+Space. This is a system feature, not Drafta.

There is no separate keyboard shortcut for emoji in Drafta — only `:`. For other ways to write faster — see the article [Typing from the keyboard: shortcuts, snippets, autocorrect](/blog/drafta-s-klaviatury/).
