# Drafta homepage

Source of [drafta.org](https://drafta.org) — the website and documentation of
[Drafta](https://github.com/rpegorov/Drafta), a Markdown notes editor for macOS.

Built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build)
(docs at [drafta.org/docs](https://drafta.org/docs/)), in English and Russian.
The prerendered build is served by Cloudflare Workers as static assets
(`wrangler.jsonc`); Workers Builds runs `npm ci && npm run build`, then
`npx wrangler deploy`.

## Development

Requires Node.js 22.12 or later.

```bash
npm ci          # install dependencies
npm run dev     # local dev server
npm run build   # astro build + vitest run
```

## Structure

```
src/pages/          Landing, legal, account and checkout pages (ru/ — Russian)
src/content/docs/   Documentation (Starlight); ru/ — Russian
src/content/legal/  Terms, privacy and refund texts (en, ru)
public/appcast.xml  Sparkle update feed of the app — written by the app's
                    scripts/release.sh, do not edit by hand
public/             Static assets: fonts, brand, favicons, _headers, _redirects
tests/              Vitest tests
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).

## Test scope

- Task checks: `TEST_BASE=<base> python3 scripts/test-policy.py <component>`.
- Preview selection: add `--plan`; see `.test-policy.json` for component names.
- Release verification: `TEST_MODE=release python3 scripts/test-policy.py all`.
- Immediate manual testing: `TEST_MODE=manual` plus the usual build/package
  command. Tests are not run; the artifact is not a verified release.

CI defaults to targeted tests; select `test_mode=release` or `manual` when
dispatching a workflow that offers these inputs. A source/dependency change can
affect several components. Full browser/app-hosted suites require release mode;
run explicit scenario tests separately for task acceptance. Existing deployment
permissions and data guards still apply.
