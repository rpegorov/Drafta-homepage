---
title: "Welcome to the Drafta blog"
description: "A fixture post for wave 2.0 — content collections, callouts and mermaid, no design yet."
lang: "en"
slug: "welcome"
date: "2026-09-25"
updated: "2026-09-25"
draftaId: "fixture-welcome-en"
tags: ["meta"]
machineTranslated: true
translation:
  sourceHash: "fixture-sha256-0000000000000000000000000000000000000000000000000000000000000000"
  sourceLang: "ru"
  provider: "anthropic"
  model: "claude-haiku-4-5"
  at: "2026-09-25T00:00:00Z"
---

This is a fixture post for **ЗАДАЧА-2.0**: it proves the `blog` content
collection resolves, callouts render, and mermaid diagrams work — the actual
post design and layout arrive in wave 2.1.

> [!NOTE]
> This is a callout. `remark-callouts.mjs` turns this blockquote into an
> `<aside class="callout callout--note">`.

Here is how a note travels from Drafta to the site[^1]:

```mermaid
graph LR
  A[Note in Drafta] --> B{Completed + #site/blog?}
  B -->|yes| C[Exported to repo]
  B -->|no| D[Stays private]
```

And a plain code block, which must not be mistaken for a diagram:

```js
export function hello() {
  return "hello from the fixture post";
}
```

[^1]: The publishing pipeline is built in a later task (2.4).
