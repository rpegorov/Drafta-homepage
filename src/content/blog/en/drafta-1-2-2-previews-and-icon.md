---
title: "Drafta 1.2.2: clean previews and a theme-matched icon"
description: "In Drafta 1.2.2, note previews in the list became plain text without Markdown formatting, and the app icon changes with the light and dark themes of macOS."
lang: "en"
slug: "drafta-1-2-2-previews-and-icon"
date: "2026-09-28"
published: "2026-09-28T15:00:00+03:00"
updated: "2026-10-03"
draftaId: "B8DC79B0-4393-4E5B-AAAB-3C125B938D5A"
tags: []
machineTranslated: true
translation:
  sourceHash: "0ffc7c9932c37765092da95eca6f0af640ead492154acbe435805cdd42ecb134"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-10-02T21:47:29.065Z"
---

A small release about two things that were an eyesore every day.

## Preview without markup

Under the note title in the list, the first line of text is shown. Previously it ended up there as is, with all the markup: `**Моя супер заметка**` with asterisks, `> [!NOTE]` from the callout block, link addresses, task checkboxes.

Now the preview is plain text:

- headings are skipped, they are already visible in the title;
- from quotes and callouts, `>` and `[!NOTE]` are removed, leaving the text itself;
- bold, italics, strikethrough, highlight, and inline code lose their markers;
- from links and `[[вики-ссылок]]`, only the link text remains;
- code blocks, horizontal rules, table separators, and lines consisting only of tags are skipped entirely.

At the same time, `snake_case` and `2*3*4` remain as they were: underscores and asterisks inside words and expressions are left untouched.

## Icon that follows the theme

Drafta had a light icon for a long time, but macOS did not show it: the variants for different themes were in the regular icon set, and the system does not substitute them for Mac apps. The icon always remained dark.

In 1.2.2, the icon is assembled in the Icon Composer format — macOS 26 understands it. In the light theme, the Dock shows the light icon; in the dark theme, the dark one. It works based on the System Settings → Appearance → Icon & widget style setting: in Automatic mode, the icon follows the system theme.
