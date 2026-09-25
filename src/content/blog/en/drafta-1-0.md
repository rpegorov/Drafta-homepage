---
title: "Drafta 1.0 has been released"
description: "Drafta 1.0 — a native Markdown editor for programmers on macOS. What's in the release, who it's for, how much it costs, and what's next."
lang: "en"
slug: "drafta-1-0"
date: "2026-09-25"
published: "2026-09-25T18:00:00+03:00"
updated: "2026-09-26"
draftaId: "ED105007-1785-43BC-B6A3-776BABC5E2D8"
tags: []
machineTranslated: true
translation:
  sourceHash: "ed3e062e748f0e34893c0d5811096051e289e4c32042e1ff03baefb32c910ada"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-09-25T22:26:17.824Z"
---

Drafta 1.0 comes out today — the first public release of my note editor for macOS. I'm making it for programmers: for those who write notes in Markdown, keep code in them, and don't want their texts locked in someone else's database.

![Drafta's main window: notebooks, statuses, and tags on the left, a list of notes with tags and notebooks in the center](./drafta-1-0/library-overview.png)

*Main window: sidebar with notebooks, statuses, and tags, note list, and space for the editor.*

## What this app is

Drafta is a native app built with Swift and SwiftUI. It's not a web app or an Electron shell. The editor inside is CodeMirror 6 with highlighting for over 50 languages.

Each note is a regular `.md` file with YAML front-matter on your disk. VS Code will open it, `grep` will find it, git will accept it. If you stop using Drafta, your notes will remain readable files. The app's source code is open under the Apache 2.0 license.

## What's in 1.0

Editor:

- three view modes — editor, preview, and split with synchronized scrolling;
- live preview of tables, Mermaid diagrams, KaTeX formulas, footnotes, and wiki links;
- table of contents, bookmarks, minimap, focus mode, search with ⌘F.

Library:

- notebooks with unlimited nesting depth;
- tags from text, including nested ones via `/`;
- four note statuses: Active, On Hold, Completed, Dropped;
- templates, snippets, trash with auto-cleanup, a graph of links between notes;
- up to 30 revisions per note with diff and one-click restore.

Data and integrations:

- synchronization via Drafta cloud or your own CouchDB, with AES-256-GCM encryption on your Mac;
- export to PDF, DOCX, HTML, and Markdown, import from `.md` and `.html`;
- AI assistant with ⌘J using your own Anthropic, OpenAI, or DeepSeek key;
- built-in MCP server: Claude and other MCP clients can read and manage the library;
- eleven built-in themes and custom themes in JSON;
- auto-update via Sparkle, checks once a day.

I'm writing a separate article about each of these parts in this blog. The blog itself is written in Drafta and published directly from it.

## Who it's for

Drafta is for you if:

- you write notes in Markdown and paste code, SQL, configs, and diagrams into them;
- you want your notes to live as files, not as rows in a closed database;
- you work on a Mac with macOS 26 or newer — on Apple Silicon or Intel.

## Where to download

The app page is [drafta.org](https://drafta.org). There's a link to the DMG from the latest release.

1. Open the DMG and drag **Drafta.app** into **Applications**.
2. The build isn't notarized yet, so macOS will block the first launch.
3. Open "System Settings" → "Privacy & Security," scroll down to the message about Drafta, and click "Open Anyway."

macOS will ask about this once. After that, updates arrive on their own, and **Drafta → Check for Updates…** checks for them on demand.

> [!NOTE]
> A Drafta account is required to use it. It has two passwords: the account password for signing in and the library password, which never leaves your Mac. No one can reset the library password — keep it in a password manager.

## How much it costs

There's one plan, with two payment periods:

| Period | Price |
|---|---|
| Month | $9.99 |
| Year | $95.88 |

The periods differ in how you pay, not in what you get. The plan includes the entire app and cloud synchronization.

Every new account starts with a 30-day trial, no card required. When the trial ends, Drafta switches to read-only mode: you can open, search, and read notes, while creating, editing, and exporting wait for a plan. Payment isn't connected yet, so nothing is charged today.

## What's next

- **Notarization and Developer ID.** Will remove the "Open Anyway" step on first launch. In progress.
- **iOS.** The iOS target already lives alongside macOS. There's no release, and I won't name a date until it's ready.
- **Windows and Linux.** A build on Rust and Tauri. Planned but not started: the macOS app comes first.

If you try Drafta 1.0, I want to know what gets in your way and what's missing.
