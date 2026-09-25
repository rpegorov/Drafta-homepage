---
title: "Добро пожаловать в блог Drafta"
description: "Фикстурный пост волны 2.0 — коллекции контента, callout и mermaid, без дизайна."
lang: "ru"
slug: "welcome"
date: "2026-09-25"
updated: "2026-09-25"
draftaId: "fixture-welcome-ru"
tags: ["meta"]
---

Это фикстурный пост для **ЗАДАЧА-2.0**: он доказывает, что коллекция `blog`
резолвится, callout рендерится, а диаграммы mermaid работают — дизайн и
вёрстка поста появятся в волне 2.1.

> [!NOTE]
> Это callout. `remark-callouts.mjs` превращает такую цитату в
> `<aside class="callout callout--note">`.

Вот как заметка попадает с Drafta на сайт:

```mermaid
graph LR
  A[Заметка в Drafta] --> B{Completed и #site/blog?}
  B -->|да| C[Экспортирована в репозиторий]
  B -->|нет| D[Остаётся приватной]
```
