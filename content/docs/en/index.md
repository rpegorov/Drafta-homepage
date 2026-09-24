---
title: What Drafta does
description: An overview of Drafta, the Markdown notes editor for programmers on macOS — editor, library, history, export, sync, the AI assistant and the MCP server.
sidebar:
  order: 1
---

Drafta is a native Markdown notes editor for macOS, built for programmers whose notes are full of
code, diagrams and formulas. It is written in Swift and SwiftUI with CodeMirror 6 as the editor —
not Electron.

**Requirements:** macOS 26.4 or later.

## Editor

- Syntax highlighting for 50+ languages, in the editor and in the preview.
- Three modes: text only, preview only, and split with synchronised scrolling.
- The preview renders:
  - GFM tables, task lists and footnotes;
  - callouts `> [!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`;
  - **Mermaid** diagrams and **KaTeX** maths (`$…$`, `$$…$$`);
  - wiki links `[[Note title]]`.
- Tables: pick the size from a grid, move between cells with Tab, and use the table toolbar.
- Slash commands, snippets, and completion for emoji and callouts.
- Line bookmarks, a table of contents, a link graph and a backlinks panel.
- Typing typography (`--` → `—`), native spell checking and custom text replacements.
- Rich HTML pasted in becomes Markdown. Images and files you paste or drop become note
  attachments.

## Library

- Notebooks nested to any depth, with notes dragged between them.
- Tags:
  - taken from the text (`#tag`, nested with `/`: `#drafta/export`);
  - added by hand;
  - each with a colour of its own.
- Statuses: Active, On Hold, Completed, Dropped.
- Pinned notes, recents and templates. The trash can empty itself never, or after 7, 30 or 90 days.
- Quick Open (⌘P): fuzzy search across notes, tags and notebooks.
- Any note can open in a window of its own.

## Revision history

Every note has a revision history: up to 30 versions, a unified diff, and one-click restore.

<!-- TODO(audit 24.09): a revision is currently taken when the history window opens and on MCP
     writes, not on every save. Adjust the wording once that is fixed. -->

## Storage and sync

Each note is a `.md` file with YAML front-matter. Revisions and attachments sit next to the notes
in the library folder.

<!-- TODO(owner decision): whether note bodies are encrypted on disk. If they are, say so here and
     drop any "opens in any editor" promise. -->

Sync between Macs:

| Option | What it is |
|---|---|
| **Drafta cloud** | Storage through your Drafta account, included in the plan |
| **Your own CouchDB 3.x** | Your server, local or remote, with no quota |

Notes are sealed on your Mac before they leave it (AES-256-GCM), so the server only ever stores
ciphertext. Sync runs at launch and a few seconds after an edit.

## Export and import

- **Export:** PDF, DOCX, HTML and Markdown, one note at a time or several at once into a ZIP.
- **Layout profiles:** Clean, Developer and Academic, plus your own. Each sets the page size,
  margins, headers and footers, a title page and a table of contents.
- **Import:** `.md` files (relative images are copied into attachments) and Bear-format `.html`.
- **Backup:** the whole library into a ZIP (⇧⌘B), plus scheduled automatic backups.

## Appearance

- 11 built-in themes:
  - light: Vellum and Default Light;
  - dark: Graphite & Ochre, Fjord, Phosphor, Amethyst Glass, Default Dark, Drafta Dark,
    Dark Islands, Tokyo Night and Solarized Dark.
- Your own themes as JSON, with a theme editor, import and export.
- Typography presets for body, heading and code fonts, size and line height.
- Formatting shortcuts can be rebound in **Settings → Keybindings**.

## AI

- **[AI assistant](./ai-assistant/)** (⌘J) rewrites a selection or writes at the caret, using your
  own Anthropic, OpenAI or DeepSeek key.
- **[MCP server](./mcp-server/)** lets AI agents search, read and maintain your library: Claude Code,
  Claude Desktop, Cursor, Zed and Codex.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| ⌘N / ⇧⌘N | New note / new from template |
| ⌘P | Quick Open |
| ⌘F | Find and replace in the note |
| ⌘J | AI assistant |
| ⌥⌘L | Show or hide the note list |
| ⌥⌘B | All bookmarks |
| ⇧⌘E | Export |
| ⌘B / ⌘I / ⌘K | Bold / italic / link |
| ⌘1 – ⌘3 | Headings H1–H3 |
| ⇧⌘L / ⇧⌘O / ⇧⌘X | Bulleted / numbered / task list |
| ⌥↑ / ⌥↓ | Move line |
| ⌘, | Settings |
