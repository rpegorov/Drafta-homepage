---
title: "Drafta 1.1.1: nested tags"
description: "In Drafta 1.1.1, a parent/child tag became a single tag, a tag tree appeared in the sidebar, and tags no longer move notes between notebooks."
lang: "en"
slug: "drafta-1-1-1-vlozhennye-tegi"
date: "2026-09-26"
published: "2026-09-26T21:00:00+03:00"
updated: "2026-09-28"
draftaId: "FDE368E2-AC39-45D4-9B42-F14323419B64"
tags: []
machineTranslated: true
translation:
  sourceHash: "7542c3aa3440655be07c79acb41529d3305c99df7d842a73916456a628e8e540"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-09-28T10:33:01.904Z"
---

In 1.1.1 tags with a slash became a full-fledged hierarchy. Previously, such a tag did not do what you expected of it.

## How it was

A tag of the form `#drafta/blog` was split into two parts. Everything before the slash was considered the path to a notebook: when saving, the note silently moved to a notebook with that name, and if it did not exist, it was created. Only the last part, `blog`, remained as the tag. That is how I ended up with an extra "Drafta" notebook next to the real one.

## How it is now

- **One tag.** `#drafta/blog` is stored in full, and in the interface it is displayed as `drafta › blog`.
- **Tree in the sidebar.** Branches collapse just like notebooks. Clicking `drafta` shows notes with it and with all its subtags, and the counter counts them together.
- **Tags do not move notes.** The notebook is set only explicitly.
- **Renaming a branch.** `drafta` → `work` turns `#drafta/blog` into `#work/blog` in all notes. Code in blocks and inline code is not touched, and an open note immediately shows the new text.
- **Colors are carried over** from old tag names to nested ones.
- **The MCP server** understands the hierarchy: a filter by `drafta` also finds subtags, `blog` finds `drafta/blog`, `list_tags` shows the tree with counters.

## Fixed

Drafta could crash if you pinned or deleted a note by swiping on a list row: the list rearranged the row while the swipe animation was in progress. Now the action is performed after the swipe closes.
