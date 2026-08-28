# Security Policy

## Supported Versions

| Package | Version |
| ------- | ------- |
| `@gasolinaradar/collectors` | >= 1.5.0 |
| `@gasolinaradar/miterd-collector` | >= 1.0.1 |
| `@gasolinaradar/dgeg-collector` | >= 1.0.1 |
| `@gasolinaradar/plenergy-collector` | >= 1.0.1 |
| `@gasolinaradar/dgt-ev-collector` | >= 1.1.0 |
| `@gasolinaradar/bonarea-collector` | >= 1.0.0 |
| `@gasolinaradar/andorra-collector` | >= 1.0.0 |

Older versions receive no security fixes.

## Reporting a Vulnerability

**Do not open a public issue.** Instead, email security details to:

> themaxter99+gasolinaradar@gmail.com

Include:

1. Which package and version is affected.
2. Steps to reproduce or a proof of concept.
3. The potential impact.

You should receive an acknowledgement within **72 hours**. We will work with you to understand and validate the issue before any public disclosure.

## Scope

In scope:

- Any `@gasolinaradar/*-collector` package or this aggregator.
- The `matching` module (SSRF, prototype pollution, ReDoS, path traversal, code injection).
- Supply-chain issues in published npm tarballs (malicious postinstall, typosquatting in dependencies).

Out of scope:

- The upstream government / third-party APIs that collectors fetch data from.
- The GasolinaRadar API or apps that consume this package (separate repos, separate policy).
- Denial-of-service against the upstream public data feeds.

## Dependency Policy

All six collectors and this aggregator use **npm** with `publishConfig.access: "public"`. Publishing requires npm 2FA. Dependabot / Renovate PRs should be reviewed and merged promptly, especially for:

- `axios` (HTTP client — SSRF / redirect risks).
- `saxes` (XML parsing — XXE is disabled by default but should stay that way).
- Any transitive dependency flagged by `npm audit`.

## Best Practices for Consumers

- Pin to a specific minor range (e.g. `^1.5.0`) and review changelogs before upgrading.
- Run `npm audit` in CI.
- Do not trust user-supplied input when calling `matchStations` or `enrichStations` — validate `location.coordinates` are finite numbers and `name`/`address` are strings before passing them in.
