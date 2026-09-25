---
title: MCP server
description: Drafta ships an MCP server inside the app with 12 tools over your whole library, and a read-only mode that removes the write tools.
sidebar:
  order: 5
---

The MCP server ships inside the app — there is nothing extra to install. It gives Claude and other MCP clients 12 tools over your whole library.

## Tools

Reading:

- `search_notes` — search notes
- `read_note` — read a note
- `list_notebooks` — list notebooks
- `list_tags` — list tags
- `formatting_guide` — read the formatting guide

Writing:

- `create_note` — create a note
- `append_to_note` — append to a note
- `update_note` — rewrite a note
- `set_note_status` — change a note's status
- `tag_note` — tag a note
- `create_notebook` — create a notebook
- `trash_note` — move a note to the trash

When an assistant rewrites a note, Drafta keeps the previous text as a revision.

## Read-only mode

Want an assistant that only looks? Run the server read-only and the write tools disappear.
