---
title: "Drafta Editor: Markdown, preview, and split"
description: "How the Drafta editor works: CodeMirror 6, three view modes, live Mermaid and KaTeX preview, callouts, table of contents, and note statistics."
lang: "en"
slug: "redaktor-markdown-prevyu-split"
date: "2026-09-25"
published: "2026-09-25T17:50:00+03:00"
updated: "2026-09-26"
draftaId: "1B30BE9B-FC43-490B-A655-6AF65116A969"
tags: []
machineTranslated: true
translation:
  sourceHash: "6187a7b50ce2ad9be9018803d563be97ba48a1afa3cbc1ce3a1e0d4ae2401792"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-09-25T22:32:04.183Z"
---

The editor is where I spend almost all my time in Drafta. That's why it's built around a simple rule: the note stays plain Markdown, and everything else — highlighting, diagrams, formulas — is drawn on top of the text and changes nothing in it. This is a continuation of the article [Drafta 1.0 has been released](/blog/drafta-1-0/).

## CodeMirror 6 and 50+ languages

Inside the window, the CodeMirror 6 editor runs. Code blocks are highlighted for more than 50 languages: Python, Rust, TypeScript, Go, SQL, YAML, Bash, and others. Headings, lists, tasks, and links are highlighted right in the source.

![The source Markdown of a note in editor mode: line numbers, a highlighted heading, a mermaid block, a numbered list, and a checklist](./redaktor-markdown-prevyu-split/editor-source.png)

*Editor mode: Markdown with line numbers, a highlighted mermaid block, a list, and tasks.*

Above the text is a formatting toolbar: bold, italic, strikethrough, link, lists, tasks, code, table, formula, diagram, and image. Below the text is a status bar with a word count, character count, and reading time.

## Three view modes

Each note has three modes:

1. **Editor** — only the source Markdown.
2. **Preview** — the rendered note.
3. **Split** — source on the left, preview on the right, synchronized scrolling.

The modes are switched with buttons in the bottom-right corner of the editor. There is no separate keyboard shortcut for them. The default mode is set in the settings.

![Split mode: on the left, the Markdown of a note with a list of ideas; on the right, the same note rendered](./redaktor-markdown-prevyu-split/split-view.png)

*Split: text on the left, result on the right. The wiki link in the preview already works as a link.*

## Live preview: Mermaid, KaTeX, tables

The preview renders what plain Markdown shows as text:

- Mermaid diagrams — flowchart, state, sequence, class, ER, and others;
- KaTeX formulas — inline `$…$` and block `$$…$$`;
- tables, footnotes, wiki links `[[Заголовок]]`;
- task checkboxes that can be checked with a click right in the preview.

![Preview of a note: a Mermaid diagram of five blocks, a numbered list, a quote, and a checklist](./redaktor-markdown-prevyu-split/preview-mermaid.png)

*The mermaid block from the source has turned into the "Note on disk → Encrypt → Replicate" scheme.*

Code blocks in the preview get line numbers, a language label, and a copy button. Tables are drawn as a grid. Diagrams survive export to PDF and DOCX — they go there as images.

![Preview of a note with HTTP and JSON code blocks with line numbers and an endpoints table](./redaktor-markdown-prevyu-split/preview-code-table.png)

*Code with a language label and line numbers, with a table below it — all from plain Markdown.*

## Callouts

For a single line that can't be missed, there are callouts in the GitHub format. Five types: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`. In the preview, each is drawn as a colored banner; in the editor, the background is highlighted.

> [!TIP]
> Type `>` and `!` at the beginning of a line — the editor will suggest a list of five types and complete the marker `> [!TYPE]` itself.

## Table of contents and statistics

A long note is convenient to read with a table of contents. The Contents panel collects headings and takes you to the right one on click. You can enable showing it right away in the settings.

![A Markdown cheat-sheet note with the table of contents panel on the right](./redaktor-markdown-prevyu-split/table-of-contents.png)

*On the right is the note's table of contents: five headings, the current one highlighted.*

The statistics button in the note header shows the number of words, characters, paragraphs, reading time, tags, and creation and modification dates.

![Statistics popover: 148 words, 823 characters, 13 paragraphs, 1 minute of reading, tags, and dates](./redaktor-markdown-prevyu-split/note-statistics.png)

*Statistics for one note: 148 words, 823 characters, 13 paragraphs.*

## Editor settings

The Editor section in the settings is responsible for the appearance and behavior of the text:

- line numbers, wrapping long lines, highlighting the active line, scrolling past the end of the text;
- spell checking and autocorrecting typos;
- autosave delay;
- Vim mode.

Font, size, line spacing, and tab width live in typography presets — they are covered in a separate article about themes.

![Editor settings: display toggles, spell checking, autosave, and Vim mode](./redaktor-markdown-prevyu-split/editor-settings.png)

*The Editor section: display, editing, and behavior, including Vim mode.*

In addition, the editor has line bookmarks, a minimap, and a focus mode. The next article is devoted to bookmarks and links between notes.
