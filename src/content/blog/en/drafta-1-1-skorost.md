---
title: "Drafta 1.1: into five thousand notes without delays"
description: "Drafta 1.1 on speed: autosave in 7 ms, search in milliseconds, launch in fractions of a second, switching notes without reloading the editor."
lang: "en"
slug: "drafta-1-1-skorost"
date: "2026-09-26"
published: "2026-09-26T16:00:00+03:00"
updated: "2026-09-28"
draftaId: "D78B1CEB-B4B1-46C8-8803-8267180DEE27"
tags: []
machineTranslated: true
translation:
  sourceHash: "c465644160ebbd00d184c2dc9de4173e7824899c03820b45c3ad9dd6fe441eef"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-09-28T10:32:58.074Z"
---

Release 1.1 is almost entirely about speed. I measured everything on an artificial library of 5,000 notes: that way you can see where the editor slows down for those who have been writing in it for years.

## What was slow

First I ran a performance audit. Three places were slowing things down the most:

- **Autosave.** Every save rebuilt the wiki-link index across the entire library. On 5,000 notes that was 150 ms on the main thread, and when typing every half second you could feel the "hiccup."
- **Search.** Every query lowercased the entire text of the library and iterated through it sequentially. Up to 1.6 seconds per query, and the interface was frozen the whole time.
- **Startup.** All files were read one by one under the file coordinator on the main thread: about 7 seconds until the first note.

## What it's like now

| Operation | Before | After |
|---|---|---|
| Autosaving a note | ~150 ms | ~7 ms |
| Text search | 0.8–1.6 s | 3–7 ms, in the background |
| Loading the library | ~7.4 s | ~0.15 s, in the background |
| Notebook counters in the sidebar | up to 218 ms | less than 0.01 ms |

- Saving now updates the indexes only for the changed note.
- Search runs against a pre-prepared copy of the text in a background thread, and ⌘P ranks title matches above text matches.
- The library is read in parallel under a single coordinator for the whole folder.
- The editor is no longer recreated when switching notes. Mermaid, KaTeX, and code highlighting are loaded only when a note uses them, and the preview redraws only the changed blocks.

## Switching modes from the keyboard

⌥⌘P cycles through the editor, split, and clean preview. The cursor, selection, and scroll position stay in place, so after a full cycle you can immediately keep typing. ⌥⌘1, ⌥⌘2, and ⌥⌘3 switch to a mode directly.

## Text safety

Since the editor became shared across all notes in a window, I separately verified that what you've typed is never lost: when switching notes, closing the window, quitting the app, during sync, and when editing via MCP. If a note is changed externally while you're typing, the text stays in the editor, and the external version is saved in revisions. The review went through four rounds until the last gap was closed.

The update will arrive on its own, or download it at [drafta.org](https://drafta.org).
