# Personal site

## Lighthouse CI

The [Lighthouse workflow](.github/workflows/lighthouse.yml) audits the production
build on pull requests, pushes to `main`, and manual runs. Home, Projects, and
Resume each get three mobile audits. The median performance score must be at
least 95; accessibility, best practices, and SEO must score 100 in every run.
The recommended Lighthouse CI assertions also check individual audits, with
render-blocking requests treated as errors.

Run the same checks locally with Chrome installed:

```sh
bun install --frozen-lockfile
bun run build
bun run lighthouse
```

HTML and JSON reports are written to `lighthouse-reports/`. GitHub saves these
and the raw `.lighthouseci/` results as the `lighthouse-reports` artifact for 14
days, including when assertions fail. No tokens or external report service are
required. See the [Lighthouse CI configuration documentation](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)
for collection and assertion options.

The `network-dependency-tree-insight` diagnostic is excluded from assertions.
Lighthouse 12.6 marks any critical request chain as a failure, including the
JavaScript modules SvelteKit already preloads with `rel="modulepreload"`. Its
preload detection only exempts `rel="preload"`. Switching preload strategies to
silence this diagnostic can cause duplicate fetching or parsing in browsers.
The tree remains visible in the reports; loading performance and actionable
render-blocking requests are enforced separately.
