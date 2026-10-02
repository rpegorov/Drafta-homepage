---
title: "Drafta 1.2.4: swipe and wide tables"
description: "In Drafta 1.2.4, horizontal scrolling of a wide table no longer collapses the sidebar: the swipe for panels only triggers when there is nothing left to scroll."
lang: "en"
slug: "drafta-1-2-4-swipe-and-wide-tables"
date: "2026-09-28"
published: "2026-09-28T18:00:00+03:00"
updated: "2026-10-03"
draftaId: "21BF857A-A437-4877-B035-B044C0F3A0E5"
tags: []
machineTranslated: true
translation:
  sourceHash: "1572487627b5ff6de44e87c368c10e426e8c901e49cbfdc57921e66362ba0b63"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-10-02T21:57:12.910Z"
---

In Drafta, the sidebar and note list collapse with a two-finger swipe on the editor. Convenient, as long as the note doesn't have a wide table.

## What was getting in the way

A wide table or a long code block is viewed with the same gesture — two fingers sideways. The editor didn't distinguish between these two cases: any noticeable horizontal movement was treated as a command for the panels. You want to look at the right columns, but instead the sidebar slides away.

## How it is now

Now, at the end of the gesture, the editor asks the page whether anything scrolled sideways: a table, a code block, a preview. If yes — it was a scroll, and the panels stay in place.

The swipe for the panels works as before in two cases:

- there's nothing to scroll sideways under your fingers — ordinary text;
- the table has already hit the edge, and you swipe further in the same direction with a separate gesture.

Safari behaves the same way with the "back" swipe: as long as there's somewhere to scroll the page, the gesture scrolls it.
