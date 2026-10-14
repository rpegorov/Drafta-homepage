---
title: "Drafta 1.4: knowledge exchange in OKF format and Ctrl-w in vim"
description: "Drafta 1.4 reads and writes Open Knowledge Format, serves it to agents via MCP, teaches vim mode to switch between panes with Ctrl-w, and fixes double prefixes in quick search."
lang: "en"
slug: "drafta-1-4-okf"
date: "2026-10-14"
published: "2026-10-14T12:00:00+03:00"
updated: "2026-10-14"
draftaId: "D01F585C-0BD1-498E-AD44-5767BDEB4239"
tags: []
machineTranslated: true
translation:
  sourceHash: "7b0e65d9f217407aa9619107dbafcd7f5fd4ff4b0e4aefa81743d11dd4e80555"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-10-14T12:50:00.425Z"
---

Notes in Drafta are ordinary Markdown files, and that has always been the main advantage: the library can be opened in any editor. In 1.4 we went further and taught Drafta the common knowledge-exchange format that both people and AI agents understand. At the same time, vim mode gained navigation between panels, and quick search stopped duplicating prefixes.

## What OKF is

Open Knowledge Format (OKF) is an open Google Cloud format for exchanging knowledge between people and agents. Its version 0.2 describes a set of rules on one page:

- a **bundle** is a directory with Markdown files;
- each **concept** (table, metric, policy, API) is one file, and the file path serves as its identifier;
- at the beginning of the file there is a YAML block, with only `type` as a required field; `title`, `description`, `resource`, and `tags` are recommended;
- `index.md` files in directories list the contents, `log.md` stores the change history;
- links between concepts are ordinary Markdown links, and a reader is obliged to preserve foreign keys in YAML.

No platform or SDK is needed for this. If a file can be opened `cat`, it can be read.

## Export and import in Drafta

Two items have appeared in the **File** menu: **Export as OKF Bundle…** and **Import OKF Bundle…**.

Export takes a notebook or the entire library and writes a bundle to a folder or to `.zip`:

- notebooks become directories, and notes become concept files with `type`, `title`, `description`, and `tags`;
- each directory has `index.md`, and at the root of the bundle it also declares version `okf_version: "0.2"`;
- wiki links `[[Заметка]]` are converted into ordinary links to a path inside the bundle, attachments are stored in `references/`;
- notes from the trash do not end up in the bundle;
- the note status (`active`, `onHold`…) is written to the extending key `drafta_status`, because the field `status` in OKF means something else: `draft`, `stable`, or `deprecated`.

Import accepts a folder or `.zip` with a bundle, including someone else's, for example Google's examples on GA4 data:

- directories become notebooks, links between concepts are converted back into wiki links;
- keys that Drafta does not know, for example nested `generated`, `sources`, and `verified`, are preserved in the note verbatim and returned on the next export;
- a note that is already in the library is skipped and not overwritten, and the final window lists everything skipped with reasons;
- files without the `type` field are skipped: according to the specification, they are not concepts.

> [!NOTE]
> For now, the keys of someone else's bundle are stored on this Mac. If you sync the library between devices, the note will arrive on the second device without them, and exporting from there will not bring them back. The original file paths of someone else's bundle are also not preserved: on re-export, the file name is taken from the note title.

## OKF for agents: MCP

The same format is available through the MCP server `drafta-mcp`, which is installed together with the app and connects to Claude Code and other clients:

- **`export_okf`** writes the bundle to a specified empty folder; you can limit it to a single notebook;
- **`import_okf`** reads the bundle from a folder and creates notes, skipping those that already exist; notes from the root of the bundle go to "Inbox";
- **`read_note`** with the `format: "okf"` parameter returns the note as an OKF concept, with type, tags, and links as paths.

The agent receives your library in the form described by the open specification, not in the app's format. Export depends on the license in the same way as export in the app, and import does not work in read-only mode.

## Vim: navigation between panels

In Normal mode, the `Ctrl-w h` and `Ctrl-w l` chain works, like switching windows in vim:

- `Ctrl-w h` moves focus from the editor to the note list, and one more time to the left goes to the sidebar;
- `Ctrl-w l` moves focus back to the right;
- in the `j` and `k` panel (or the arrows) move the selection, `Return` opens: in the note list a note opens and focus returns to the editor, in the sidebar focus moves to the note list;
- `Esc` returns focus to the editor.

The keys are read by physical position, so on a Russian keyboard layout the chain works without switching, just like the rest of Normal mode. The active panel is highlighted with a border. Navigation is enabled only together with vim mode, and shortcuts with ⌘ and ⌥ work as before.

There are still limitations: in the sidebar, `j` and `k` move through all rows, including collapsed notebooks and tags, and you can enter the panels only when a note is open.

## Quick search without double prefixes

In quick search with ⌘P, mode prefixes (`>` for commands, `#` for tags, `b ` for notebooks, `t ` for tags) used to remain in the line while the mode was already enabled. Because of this, `>` appeared twice, and deleting the extra character turned the mode off entirely. Now:

- the prefix enables the mode and disappears from the line, and the mode is shown by an icon and a label;
- deleting text does not turn the mode off; you exit it with `Backspace` on an empty line;
- `Tab` turns a single `b` or `t` into notebook or tag search mode.

## How to update

Drafta will offer the update itself, and if not, download the build from [drafta.org](https://drafta.org). The app is signed with an Apple Development certificate, without notarization, so on first launch it must be allowed in **System Settings → Privacy & Security → Open Anyway**.

If you work with agents and keep knowledge in Drafta, try exporting a notebook to OKF and opening the bundle in another tool. If you find a discrepancy with the specification, write to us and we will fix it.
