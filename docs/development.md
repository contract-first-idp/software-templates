# Development and testing

[Back to the repository overview](../README.md)

Use this guide when changing a Backstage template, generated skeleton, or template-to-chart
contract.

## Prerequisites

- Node.js and npm
- Sibling `developer-charts` and `platform-components` checkouts only for manual compatibility
  testing
- Maven repository access only when compiling generated Java baselines
- A Backstage instance only for opt-in smoke tests

## Backstage runtime requirements

The template catalog expects these Scaffolder actions:

| Capability | Action IDs |
| --- | --- |
| Read catalog and files | `catalog:fetch`, `fetch:plain:file` |
| Render content | `fetch:template` |
| Parse, transform, and write contracts | `roadiehq:utils:fs:parse`, `roadiehq:utils:fs:write`, `roadiehq:utils:jsonata`, `roadiehq:utils:serialize:yaml` |
| Publish repositories and pull requests | `publish:github`, `publish:github:pull-request` |
| Register entities | `catalog:register` |
| Configure webhooks | `github:webhook` |
| Troubleshoot execution | `debug:log` |

Install the Backstage catalog, fetch, and GitHub Scaffolder modules that provide those actions,
plus `@roadiehq/scaffolder-backend-module-utils`. RHDH 1.10 uses the compatible dynamic-plugin
overlay `roadiehq-scaffolder-backend-module-utils:bs_1.49.4__4.1.2`; verify the four
`roadiehq:utils:*` actions in the installed action list before running a template.

GitHub publication, pull requests, team grants, webhooks, branch protection, and catalog discovery
use the CF-IDP GitHub App. Each target organization must already contain `domain-maintainers`,
`domain-contributors`, and `domain-viewers`, and the App must be installed with access to generated
repositories. A Gitea compatibility plugin may supply the GitHub-compatible actions used by the
checked-in lab configuration.

## Fast feedback

Install locked dependencies and run the deterministic suite:

```bash
make test
```

All Node and Jest tooling is scoped under `test/`; the repository itself is not an npm package.
The direct equivalent is:

```bash
npm ci --prefix test
npm test --prefix test
```

The default command runs only repository-local Jest suites:

| Suite | Command | Covers |
| --- | --- | --- |
| Repository contracts | `npm run --prefix test test:contracts` | Registered templates, metadata, actions, and file contracts |
| Skeleton rendering | `npm run --prefix test test:skeletons` | Representative generated repositories and profile-specific output |

Bookinfo and cross-System scenarios under `test/fixtures/` are test data only; production catalog
metadata must not register the fixture tree.

`make test` does not require sibling repositories, a live Backstage instance, cluster, or Schema
Registry. GitHub Actions currently runs this repository-local command only.

Release-policy tests are intentionally excluded from the fast suite. `make release-check` runs the
fast suite, the focused release-policy tests, and validation of the current release candidate.

## Template-to-chart compatibility

Use this standard workspace layout:

```text
workspace/
├── platform-components/
├── software-templates/
└── developer-charts/
```

Render representative generated values and verify their active consumers against both siblings:

```bash
DEVELOPER_CHARTS_DIR=../developer-charts \
PLATFORM_COMPONENTS_DIR=../platform-components \
npm run --prefix test test:compatibility
```

Compatibility checks are manual and are not run by repository-local CI for now.

Use this whenever changing a generated Domain entrypoint, System discovery file, Component values,
Resource values, or any chart value passed by a template.

Verify the configured released revision separately:

```bash
npm run --prefix test test:remote-revision
```

When publishing the next coordinated release, create a new immutable tag, update the platform
contract to it, and let the remote check consume that declaration. Do not move an existing tag.

Helm implementation behavior belongs in `developer-charts`; this repository verifies the producer
side of the shared contract.

## Generated Java baselines

Compile all generated Component profiles when Maven repositories are reachable:

```bash
npm run --prefix test test:build
```

This test is intentionally separate from `make test` because it downloads external build
dependencies.

## Live Backstage smoke tests

Create local configuration, then run representative creation and promotion dry-runs:

```bash
cp test/.env.example test/.env
npm run --prefix test test:smoke
```

The suite exercises Backstage rendering only. It does not execute Git mutations, Tekton,
Apicurio, Argo CD, or image promotion. Required fixture entities under `test/fixtures/scenarios/`
must be registered separately in the live test environment; production catalog metadata never
references the fixture tree. System environment
activation is not currently covered by the smoke suite.

Retain dry-run workspaces for troubleshooting:

```bash
npm run --prefix test test:debug
```

Generated output is written under `test/output/`. Remove it with `npm run --prefix test clean`.
Never commit `test/.env`.

## External-service checks

The following commands make real external calls and are never part of the default suite:

```bash
APICURIO_LIVE=1 npm run --prefix test test:apicurio-live
npm run --prefix test test:promotion-live
```

Run them only in an explicitly prepared environment with the required service and cluster access.

## Change checklist

- Keep template and skeleton paths relative to the registered template source.
- Preserve the distinction between tenant SCM annotations and platform chart coordinates.
- Add or update a deterministic contract test for every generated Git signal.
- Run `make test`.
- Run `npm run --prefix test test:compatibility` with both sibling checkouts when a coordinated
  contract changes.
- Run `npm run --prefix test test:build` when a generated Java profile or POM changes.
- Update the root README or architecture guide when a golden path, trust model, or lifecycle
  changes.
