---
title: "What Drafta looks like: themes, typography, export"
description: "Eleven built-in Drafta themes and custom themes in JSON, four typography presets, and export to PDF, DOCX, HTML, and Markdown via styling profiles."
lang: "en"
slug: "temy-tipografika-eksport"
date: "2026-09-25"
published: "2026-09-25T16:40:00+03:00"
updated: "2026-09-26"
draftaId: "6A94E8CA-E33E-4CDD-B16B-E4E084E85D1B"
tags: []
machineTranslated: true
translation:
  sourceHash: "714560443111216c11ec3ef4e310a48d27c773281377bf581091195acd9940b5"
  sourceLang: "ru"
  provider: "deepseek"
  model: "deepseek-chat"
  at: "2026-09-25T23:34:51.270Z"
---

I read notes more often than I write them, so the look of text in Drafta is configured as thoroughly as the editor's behavior. This article covers themes, typography, and how a note looks outside the app, after export. This is the last article in the series that began with [Drafta 1.0 has been released](/blog/drafta-1-0/).

## Eleven built-in themes

Drafta has 11 built-in themes. Five signature ones:

- Graphite & Ochre
- Vellum
- Fjord
- Phosphor
- Amethyst Glass

And six more: Default Light, Default Dark, Drafta Dark, Dark Islands, Tokyo Night, and Solarized Dark.

![Appearance section: a list of eleven built-in themes with color swatches, Fjord selected](./temy-tipografika-eksport/builtin-themes.png)

*Appearance: eleven built-in themes, each with four color swatches. Fjord is selected.*

A theme colors the entire window: the sidebar, the note list, the editor, and Markdown highlighting.

![Drafta window in the Fjord theme: blue-gray tones, a note with a table and a checklist in editor mode](./temy-tipografika-eksport/fjord-theme.png)

*Fjord theme: cool blue-gray tones across all three columns of the window.*

![Drafta window in a light theme: warm paper background, note list with tags](./temy-tipografika-eksport/light-theme.png)

*Light theme: the same sidebar and note list on a warm background.*

The styling of the window title bar, menus, and system dialogs follows the editor theme by default. It can be pinned to light or dark separately. If a theme supports a translucent window and it is enabled, three sliders set the glass intensity separately for the editor, the note list, and the sidebar.

## Custom themes

Built-in themes are read-only. To make your own, I duplicate a built-in one and edit the copy in the theme editor. Custom themes live in a separate Custom Themes section: they can be edited, duplicated, exported, and deleted.

![Appearance section with three custom themes in the Custom Themes block and buttons for editing, copying, exporting, and deleting](./temy-tipografika-eksport/custom-themes.png)

*Custom Themes: copies of built-in themes, each with buttons for editing, duplicating, exporting, and deleting.*

A theme is a JSON file. You can create your own theme without the editor too: just put a `.json` file into the themes folder. A button in the Appearance section opens this folder in Finder.

> [!TIP]
> A theme you like is easy to share with a colleague: export it to JSON, and they put the file into their themes folder.

## Typography

Font, size, line spacing, and tab width are grouped into presets. There are four built-in ones:

| Preset | Size | Line spacing |
|---|---|---|
| Default | 14 pt | 1.6 |
| Reading | 18 pt | 1.8 |
| Compact | 13 pt | 1.4 |
| Mono | 14 pt | 1.6 |

Below the list is a preview: three heading levels, a paragraph, and inline code. The "+" button creates your own preset.

![Typography section: four built-in presets Default, Reading, Compact, Mono and a preview of headings and text](./temy-tipografika-eksport/typography-presets.png)

*Typography: four presets with size and spacing, preview below.*

## Export: four formats

A note leaves Drafta in four formats: PDF, DOCX, HTML, and Markdown. The export dialog opens with ⇧⌘E or the Export… item in the note menu. Local images are carried over along with the note.

The same menu has quick items: export straight to the desired format, Export as Bundle… — a ZIP archive with the note, and Copy as Markdown — the source to the clipboard.

![Note menu: Unpin, Set Status, Revision History, Save as Template, Export…, Export as Markdown, HTML, PDF, Bundle, Copy as Markdown, Move to Trash](./temy-tipografika-eksport/export-menu.png)

*Note menu: export dialog, quick formats, archive, and copying Markdown.*

## Styling profiles

The look of the result is set by a profile. There are three built-in ones: Clean, Developer, and Academic. The selected profile is the one the export dialog opens with. Built-in profiles are read-only: to change a profile, you duplicate it.

![Export section of settings: three built-in profiles Clean, Developer, and Academic with color swatches, Clean selected](./temy-tipografika-eksport/export-profiles.png)

*Export: Clean, Developer, and Academic profiles. Clean opens by default.*

In the export dialog itself, you choose the format and profile, page size and orientation, title page, headers and footers, and table of contents. The result preview is visible there too. Changes in the dialog apply only to the current export and do not change the profile.

Mermaid diagrams go into PDF and DOCX as images, so a diagram from a note remains a diagram in the document too.

## Import

In the other direction, Drafta imports `.md` and `.html`. Notes from another app become the same Markdown files as the rest.

This concludes the series about Drafta 1.0. If something is missing, write to us — it's the best way to influence future versions.
