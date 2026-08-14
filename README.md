# Contract-First IDP Software Templates

Backstage golden paths that create Contract-First IDP catalog entities, tenant repositories, and
reviewable GitOps desired state.

This repository is primarily for platform engineers who maintain golden paths and contributors who
change template contracts. Application developers normally use the templates through Developer Hub
and do not need to clone this repository.

## Overview

The templates capture developer intent in Git. Backstage creates repositories and pull requests;
Argo CD combines the resulting tenant state with trusted implementations from `developer-charts`.
Platform installation remains in `platform-components`.

The catalog hierarchy is:

```text
Domain
  -> System
      -> API
      -> Component
      -> Resource
```

A Domain owns its Systems. APIs, Components, and Resources are peers within a System. See
[Architecture and Git contracts](docs/architecture.md) for ownership, reconciliation, discovery,
and lifecycle details.

## Golden Paths

For a new tenant, use the first five paths in order. Use activation and promotion as the
application moves through its lifecycle.

| Order | Golden path | Result |
| ---: | --- | --- |
| 1 | **Create Tenant Domain** | Domain repository and platform-admission pull request |
| 2 | **System Golden Path** | System repository activated in the build environment |
| 3 | **OpenAPI Specification Golden Path** | API contract repository and Registry publication configuration |
| 4 | **Component Golden Path** | Implementation repository, tooling, API selections, and build desired state |
| 5 | **Resource Golden Path** | Resource repository and environment desired state |
| Repeat | **Activate System Environment** | Domain pull request that activates a System environment |
| Repeat | **Promote Component** | System pull request that selects a release in the next environment |

To onboard a tenant, follow [Getting started](docs/getting-started.md).

## Independent Release

This repository starts at `1.0.0` and declares compatible dependency ranges independently:

```text
software-templates:  v1.0.0
platform-components: >=1.0.0 <2.0.0
developer-charts:    >=1.0.0 <2.0.0
```

Treat release tags as immutable. The platform target records the exact template and chart revisions
selected by an installation. See [Release policy](docs/release-versioning.md).

## Documentation

- [Getting started](docs/getting-started.md) — platform target, organization prerequisites, and
  tenant bootstrap
- [Architecture and Git contracts](docs/architecture.md) — catalog model, ownership, desired-state
  files, release workflows, and current constraints
- [Development and testing](docs/development.md) — Backstage requirements, template changes, test
  suites, and coordinated validation

Generated repository READMEs under `skeletons/**` are operational documentation for the
application teams that own those repositories.

## Repository Structure

| Path | Purpose |
| --- | --- |
| `catalog-info.yaml` | Backstage Location that registers the active templates |
| `templates/` | Entity creation, System activation, and Component promotion templates |
| `skeletons/` | Content rendered into generated repositories and pull requests |
| `docs/` | Architecture, onboarding, and contributor guides |
| `test/contracts/` | Template and template-to-chart contract tests |
| `test/skeletons/` | Generated repository tests |
| `test/coordinated/` | Manual current-source compatibility tests across sibling repositories |
| `test/smoke/` and `test/live/` | Opt-in Backstage and external-service checks |

## Development

Run the local deterministic suite:

```bash
make test
```

The direct equivalent is `npm ci --prefix test` followed by `npm test --prefix test`. See
[Development and testing](docs/development.md) before changing a template, skeleton, or shared
Git contract.
