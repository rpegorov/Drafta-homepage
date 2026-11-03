
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

## Test execution modes

Run task-related tests with `TEST_BASE=<base> python3 scripts/test-policy.py <component>`;
use `--plan` to inspect commands. Components and impact paths are in `.test-policy.json`.
Use `TEST_MODE=release` for complete release verification. For immediate manual
testing, use `TEST_MODE=manual` and the existing build/package command; report
that tests were not run. Release optimization is not release verification.
Build, lint, data guards and migration checks remain required.
