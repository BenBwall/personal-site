# Personal site

## W3C validation

The [W3C validation workflow](.github/workflows/w3c-validation.yml) builds the
site for the Domus base path and checks every generated HTML file and stylesheet
on pull requests, pushes to `main`, and manual runs. It uses the
[Nu Html Checker](https://github.com/validator/validator) and the
[W3C CSS Validator](https://github.com/w3c/css-validator) locally. Site content
is never submitted to the public validation services.

Run both validators locally with Java 17 or newer installed:

```sh
bun install --frozen-lockfile
bun run build
bun run validate:w3c
```

Use `bun run validate:w3c html` or `bun run validate:w3c css` to run one check.
An optional second argument selects an output directory instead of `dist`.
The first run downloads the latest Nu checker and the W3C CSS Validator's
`cssval-20250226` release to `node_modules/.cache/w3c/`. Delete that cache to
refresh the Nu checker. Later validation runs work offline.

HTML validation checks markup; CSS diagnostics from Nu are handled by the
separate CSS check. CSS validation uses the CSS3 + SVG profile, checks embedded
styles and style attributes as well as `.css` files, and treats vendor extensions
as warnings. Validation errors fail the command and CI; warnings do not. Both
checks run even when the first one fails. Text reports are written to
`w3c-reports/` and uploaded by GitHub for 14 days, including failed checks.

The CSS validator has incomplete support for modern CSS used by this site,
including `@property` and `light-dark()`. These diagnostics remain in the reports
and currently fail the CSS check; no errors are suppressed in that check.

## Lighthouse CI

The [Lighthouse workflow](.github/workflows/lighthouse.yml) audits the production
build on pull requests, pushes to `main`, and manual runs. Home, Projects,
Resume, and Rapport each get three mobile audits. The median performance score
must be at least 95; accessibility, best practices, and SEO must score 100 in every run.
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
