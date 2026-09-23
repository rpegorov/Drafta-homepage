# Product screenshots — the declared slots

These are the real-UI slots used by the new drafta.org. **The PNGs are not
committed yet**: screen-recording permission needs a restart of the harness
session, so the site ships with the slots wired for a drop-in later.

A missing file is harmless by design. Every `<img>` carries an `onerror`
handler that adds `.shot--missing` to its `.shot` figure; `.shot__ph`
("Screenshot pending", on the Russian twin "Скриншот готовится") is hidden
while the PNG loads and appears only in that state. Nothing else has to change
when the real captures arrive.

## The slots

| File | Content | Where used |
|---|---|---|
| `editor.png` | editor + sidebar (notebooks, tags, statuses) | hero |
| `split.png` | split mode, Markdown left / rendered right | feature row 1 |
| `export.png` | export dialog or a rendered PDF/DOCX page | feature row 3 |
| `tables.png` | a Markdown table in the editor with the grid picker | feature row 2 |

All four are already referenced by `index.html` and `ru/index.html` in exactly
this order; each `<img>` also carries a written `alt` and a translated `<figcaption>`
on both twins, so a filled slot changes nothing but this directory.

## Capture rules

* **2× retina, 2400 px wide → 1500 px tall** (a 1200 × 750 pt window captured at
  2×). All four slots are declared in markup as `width="2400" height="1500"`, so
  a different aspect ratio would shift the layout on load.
* Dark app theme (`drafta-dark`); export on the page background `--bg` (#0e0f11),
  **no transparency** and no drop shadow baked into the PNG — the page draws the
  frame, border and shadow itself.
* No macOS desktop, no other windows, no personal note titles. Use neutral demo
  content that shows the feature the row is about.
* Keep the UI at 100 % zoom and the sidebar visible where the row is about the
  sidebar.
* PNG, optimised (`pngquant`/`oxipng` are fine) — a slot should stay under ~400 KB.

## Markup contract (already in the pages — do not change it)

```html
<figure class="shot">
  <div class="shot__frame">
    <img class="shot__img" src="/assets/img/screenshots/editor.png"
         alt="…" width="2400" height="1500" loading="lazy" decoding="async"
         onerror="this.closest('.shot').classList.add('shot--missing'); this.remove();">
    <div class="shot__ph" aria-hidden="true">Screenshot pending</div>
  </div>
  <figcaption class="shot__caption">…</figcaption>
</figure>
```

Every image needs a real `alt`, `width`, `height` and the `onerror` handler.
Dropping the PNG into this directory with the exact filename above is the whole
integration step; no CSS and no markup changes are involved.
