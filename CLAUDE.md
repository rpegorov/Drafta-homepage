
<!-- craftzman-brand:start -->
## Бренд
Проект выходит под личным брендом **craftzman**. Правила, токены и ассеты — скилл `craftzman-brand` (`~/.claude/skills/craftzman-brand/`, живая система: https://claude.ai/artifact/8m9AZL8iPX81t7yDYp4M5H).
- Тип проекта: **product** (personal — полный бренд; product — свой `--product-*` accent, остальное бренд, в футере `by craftzman` + печать 16px).
- Раскладка: **public** (static — каталог и есть корень сайта, без сборки; public — ассеты в `public/`, `src/styles/tokens.css` импортируется из `src/layouts/Base.astro`).
- Токены: `src/styles/tokens.css` (копия `tokens.web.css` из скилла; акцент Drafta и rem-шкала — `src/styles/product.css`) — единственный источник цветов/отступов/шрифтов; менять в артефакте, затем синхронизировать.
- Шрифты: `fonts/*.woff2` (self-hosted). Ассеты: `brand/`, фавиконы в корне веб-каталога. `<head>` — `src/layouts/Base.astro` (образец: `src/styles/brand-head.snippet.html`).
- Тема: `<html data-theme="paper">` / `"sumi"`.
- Stop-хук гоняет `brand-lint.sh`; вручную: `~/.claude/skills/craftzman-brand/scripts/brand-lint.sh .`
<!-- craftzman-brand:end -->
