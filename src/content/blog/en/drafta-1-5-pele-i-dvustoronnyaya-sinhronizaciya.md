---
title: "Drafta 1.5: Mermaid on Pele and synchronization without a button"
description: "Drafta 1.5 draws Mermaid diagrams with a single Pele renderer and picks up changes from the server on its own within seconds — without a \"Synchronize\" button."
lang: "en"
slug: "drafta-1-5-pele-i-dvustoronnyaya-sinhronizaciya"
date: "2026-10-25"
published: "2026-10-25T12:00:00+03:00"
updated: "2026-10-25"
draftaId: "BA9DAE0C-CF20-4820-BC69-C92139F1B3D2"
tags: []
machineTranslated: true
translation:
  sourceHash: "ba439a636f902b27c82bd23daeea3de4cc3de85dba74d98471bcf0ae55071c7f"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-10-25T14:39:49.124Z"
---

In Drafta 1.5 there are two themes, and both are about waiting. Mermaid diagrams are now drawn by a single renderer instead of two libraries, and the notes library no longer requires a "Sync" button to see an edit made elsewhere. Individually these are details; together, the app has stopped making you wait.

Diagram rendering landed in 1.5.0, synchronization in 1.5.1; 1.5.0 was never released publicly, so both changes arrive at once in 1.5.1.

## Diagrams: two libraries became one

The previous renderer was assembled from two libraries: `mermaid` drew most diagram types, `beautiful-mermaid` the rest. Two libraries brought with them two parsers and two sets of styles, and it showed:

- different diagram types looked different and responded differently to the theme;
- colors did not follow the app theme: the diagram stayed light on a dark background;
- the first render of a diagram took noticeable time because the whole library was loaded and initialized;
- the editor bundle was large.

In 1.5 both packages are replaced by one — `pele`. It alone draws all diagram types that Mermaid syntax understands, and takes colors from the active theme: when the theme changes, the diagram is redrawn in the new colors, including series colors on charts. The renderer chunk in the bundle takes about 150 lines of adapter instead of three and a half thousand lines of the previous `mermaid` chunk, the bundle is about 4.4 MB smaller, and a diagram appears several times faster on first display.

We also fixed bugs: diagram text that Mermaid cannot parse is now shown in the diagram's own error block — for all types, not just those handled by the second library.

For you this means exactly one thing: you paste a ```` ```mermaid ```` block, and it renders quickly, in your theme's colors, in the preview and in live view. In PDF and DOCX, diagrams are still exported as images.

## Synchronization: a call instead of a schedule

Previously Drafta synchronized in three cases: on launch, three seconds after your own edit, and via the button. If someone else changed a note — a second Mac, a Windows client, or an MCP server through which an agent works — the open app did not learn about it until a manual sync. That is exactly why the tracker gained a "continuous autosync" item: the agent edits the note while you look at the old text.

In 1.5.1 the app holds a single connection to CouchDB and waits. More precisely, it holds a longpoll request to the changes feed:

```
GET /drafta/_changes?feed=longpoll&timeout=25000&since=<чекпойнт>&include_docs=false
```

While the server is quiet, the request hangs for up to 25 seconds and returns empty — then the app immediately sends the next one. As soon as someone changes a note, the server responds immediately, and the app starts the usual sync cycle. The "call" itself applies nothing: merging, writing to disk, and conflicts remain in the same code that worked before — with three-way text merging and protection against races on receive.

A few details without which this would work poorly:

- **A fresh client for each call.** The managed token lives 15 minutes, while the hold is 25 seconds; it is simpler to take a new client with new authorization than to catch token expiry on a long connection.
- **No heartbeat.** The response is read in full, and the service empty heartbeat lines that the server sends in long-polling mode would break JSON parsing. Instead — a hold timeout and our own request timeout with a margin.
- **Backoff on error.** The network drops or a proxy cuts the connection — the app waits 10 seconds, then 20, 40, and up to 60, and after the first successful hold returns to the base rhythm. No error messages over the editor: synchronization is a background affair.
- **Sync on window activation.** A held socket in the background may fall asleep along with the process; when you return to Drafta, the app synchronizes — but no more than once every 10 seconds, so that ⌘-Tab does not turn into a network workout.

The "Sync" button and the sync three seconds after an edit remain in place — as manual control and as a quick save of your own.

How long does this take in practice? We tested on a live server: a note created via an MCP replica on another machine appeared in the open app 0.0 seconds after it reached the server. From the MCP call to the text appearing, about 4 seconds passed, but three of them are the replica's own push, which it does 3 seconds after the edit. After that there is nothing to wait for: the call fires immediately.

Synchronization remains fully encrypted on the client: the server sees only encrypted documents, and the "call" is a read of the changes list, without documents.

## What this changes

- **Agents.** An edit via MCP is visible in the open app within seconds: you can edit a note with an agent and immediately see the result on screen without pressing anything.
- **Multiple Macs.** A change on one Mac arrives on another by itself while Drafta is open — including when you have simply switched to it.
- **Windows.** The client still synchronizes on a timer and without sync on launch; this is a separate task, the next step is to teach it to also come immediately on start and once every 30 seconds.

One honest risk remains: if a proxy or router cuts the held connection before 25 seconds, the call degenerates into polling every 10–60 seconds. This is no worse than the previous behavior, but also not "instant." This can only be verified on a live route — which is what we did on KeenDNS.

## How to update

Open **Drafta → Check for Updates…** or wait for the daily check: 1.5.1 will arrive on its own. The build is signed with an Apple Development certificate without notarization, so on first launch macOS will ask you to allow the app in **System Settings → Privacy & Security** with the **Open Anyway** button. Updates are verified with an EdDSA signature before installation.

The full list of changes is in [CHANGELOG](https://github.com/rpegorov/drafta-releases#readme) and in the update window. If a diagram renders differently than you expected, or synchronization somewhere stays silent for longer than seconds — write to us, we'll figure it out.
