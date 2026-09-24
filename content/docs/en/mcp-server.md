---
title: Drafta as an MCP server for AI agents
description: Connect your Drafta library to Claude Code, Claude Desktop, Cursor, Zed or Codex over MCP, so agents can search, read and maintain your notes.
sidebar:
  order: 3
# Draft: not published until drafta-mcp ships inside Drafta.app and can open an encrypted
# library (audit 24.09, P0 #8). The binary path below is the intended one.
draft: true
---

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) is an open protocol that gives
AI agents access to outside data and tools. Drafta includes an MCP server, `drafta-mcp`. Connect it
to an agent, and the agent can use your notes library as a knowledge base.

## Why you would

- **Context for code.** Claude Code or Cursor find your notes on a project's architecture,
  decisions and pitfalls, and read them before they touch the code.
- **A work log.** The agent appends a session summary to a note, moves a task's status and tags it.
- **Drafts.** The agent creates a note in the right notebook, written in Markdown that Drafta renders:
  Mermaid diagrams, maths, callouts and task lists.
- **Search your knowledge base.** Ask your assistant in Claude Desktop what you wrote about a topic,
  and it finds the notes.

The server runs locally and talks to the agent over stdin/stdout. It opens no network port. It reads
and writes the library folder directly, and if Drafta is open, the changes show up in it right away.

## Getting the server

The server ships inside the app:

```
/Applications/Drafta.app/Contents/Helpers/drafta-mcp
```

<!-- TODO: confirm the path once the binary is embedded in the .app, and describe a "Copy
     configuration" button in Settings if one is added. -->

### Options

| Flag | What it does |
|---|---|
| `--library <path>`, `-l <path>` | The library folder. Defaults to `~/Library/Application Support/Drafta/Library`. Give a full path, because `~` is not expanded |
| `--read-only`, `-r` | Read-only mode: write tools are hidden from the agent |

> [!TIP]
> Start with `--read-only`. Give the agent write access once you have seen how it handles your
> notes.

## Connecting a client

### Claude Code

```sh
# read-only, for every project
claude mcp add --scope user drafta -- /Applications/Drafta.app/Contents/Helpers/drafta-mcp --read-only

# read and write
claude mcp add --scope user drafta -- /Applications/Drafta.app/Contents/Helpers/drafta-mcp
```

Check it with `claude mcp list`, or with `/mcp` inside a session.

### Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "drafta": {
      "command": "/Applications/Drafta.app/Contents/Helpers/drafta-mcp",
      "args": ["--read-only"]
    }
  }
}
```

Then restart Claude Desktop.

### Cursor

Use `~/.cursor/mcp.json` for every project, or `.cursor/mcp.json` for one. The format is the same
as Claude Desktop's.

### Zed

In `settings.json`:

```json
{
  "context_servers": {
    "drafta": {
      "command": "/Applications/Drafta.app/Contents/Helpers/drafta-mcp",
      "args": ["--read-only"]
    }
  }
}
```

### Codex CLI

In `~/.codex/config.toml`:

```toml
[mcp_servers.drafta]
command = "/Applications/Drafta.app/Contents/Helpers/drafta-mcp"
args = ["--read-only"]
```

> [!NOTE]
> Each client defines its own configuration format, and those formats change. If an example does not
> work, check the client's documentation.

## Tools

### Read

These tools are always available.

| Tool | Parameters | What it does |
|---|---|---|
| `search_notes` | `query`, `tag`, `status`, `notebook`, `limit` (default 20, max 100) | Case-insensitive substring search over titles, bodies and tags. Newest first, trash excluded. An empty `query` returns the latest notes |
| `read_note` | `note`: a UUID or title | Returns the full note, with its title, id, tags and edit date |
| `list_notebooks` | — | The notebook tree, with UUIDs |
| `list_tags` | — | Every tag in the library |
| `formatting_guide` | — | A cheat sheet of the Markdown Drafta renders |

### Write

These tools are hidden in `--read-only` mode.

| Tool | Parameters | What it does |
|---|---|---|
| `create_note` | `title`*, `content`*, `notebook`, `tags`, `status` | Creates a note, in Inbox if no notebook is given |
| `append_to_note` | `note`*, `text`* | Appends text to the end of a note |
| `update_note` | `note`*, `content`* | Replaces the whole text |
| `set_note_status` | `note`*, `status`* | Sets the status: `active`, `onHold`, `completed`, `dropped` or `none` |
| `tag_note` | `note`*, `tags`* | Adds tags |
| `create_notebook` | `name`*, `parent` | Creates a notebook, or returns the existing one with that name |
| `trash_note` | `note`* | Moves a note to the trash. The file is kept |

\* Required. A notebook can be given by name or by UUID.

Before `append_to_note` and `update_note`, the previous text is saved to the revision history, so
any change an agent makes can be rolled back.

### Resources

The server exposes up to the 200 most recent notes as `drafta://note/<UUID>` resources of type
`text/markdown`. Clients that can attach resources, such as Claude Desktop, can put a note in context
without calling a tool.

## Working alongside the app

- The app watches the library folder and picks up an agent's edits live.
- If an agent changes a note where you have unsaved typing, Drafta asks which to keep:
  - **Reload**: take the version on disk;
  - **Keep mine**: keep what you typed.
- An agent's edits sync to your other Macs like any other change.
- The server also works when the app is not running.

## Security

- An agent with write access can rewrite any note or move it to the trash. If you only need it for
  reference, use `--read-only`.
- Whatever the agent reads goes to its model provider, on the terms you have with that provider.
- The server runs as your user, makes no network connections and opens no ports.

## Limits

- There are no tools yet to:
  - remove a tag;
  - move a note to another notebook;
  - restore a note from the trash;
  - read revision history;
  - work with attachments.
- `search_notes` matches substrings, unlike search in the app.
- `list_notebooks` shows two levels of nesting.

<!-- TODO(audit 24.09) before publishing:
     1. embed drafta-mcp in Drafta.app and give the real path;
     2. give the server the library key — against an encrypted library search is empty today and
        create_note writes plaintext;
     3. check the licence before writes;
     4. fix create_note with an invalid status (it creates the note and then returns an error). -->
