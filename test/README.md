# Template tests

The default suite is deterministic and service-free:

```bash
make test
```

All Node and Jest tooling is scoped under `test/`; the repository itself is not an npm package.
The direct equivalent from the repository root is:

```bash
npm ci --prefix test
npm test --prefix test
```

It validates repository-local template contracts and renders representative skeletons. Parameter
inputs live under `test/fixtures/inputs/`; coordinated Bookinfo and cross-System data lives under
`test/fixtures/scenarios/`. These files are test data, not production catalog entities.

Release-policy tests are separate from normal discovery. Run `make release-check` to execute the
fast suite followed by the focused release tests and release-candidate validator.

Cross-repository compatibility is intentionally manual for now. Use this sibling layout:

```text
workspace/
├── platform-components/
├── software-templates/
└── developer-charts/
```

This is a contributor integration workspace. Workshop installers normally fork only
`platform-components` and consume released template and chart dependencies; they do not need all
three checkouts.

The current-source integration tests have one owner under `test/coordinated/`. Run those consumption
contracts and the chart compatibility checks explicitly:

```bash
DEVELOPER_CHARTS_DIR=../developer-charts \
PLATFORM_COMPONENTS_DIR=../platform-components \
npm run --prefix test test:compatibility
```

These checks are not part of `make test` or repository-local GitHub Actions. They fail when the
sibling repositories are absent or incompatible.

The release-boundary check fetches the configured repository at the one supported coordinated
revision and verifies that its canonical chart paths exist:

```bash
npm run --prefix test test:remote-revision
```

During release preparation, update the platform contract to the intended immutable release tag and
run this check separately. Do not move an existing release tag.

The generated Maven baselines can be compiled separately when Maven repositories are reachable:

```bash
npm run --prefix test test:build
```

## Live Backstage smoke tests

The smoke suite sends one representative dry-run request for Domain, System, API, Component,
Resource, and promotion. It exercises Backstage template rendering only; it does not execute Git,
Tekton, Apicurio, Argo CD, or image promotion.

```bash
cp test/.env.example test/.env
npm run --prefix test test:smoke
```

The command fails immediately and lists missing configuration if the live Backstage URL and catalog
references are unavailable. It also fails if the dedicated smoke Jest configuration discovers zero
tests. Register required fixture entities separately in the prepared test
Backstage installation; the production root catalog never references `test/fixtures/`. Use
`npm run --prefix test test:debug` to retain dry-run output under `test/output/`.

Real Registry mutation remains explicitly opt-in:

```bash
APICURIO_LIVE=1 npm run --prefix test test:apicurio-live
```

Real promotion transport, when the existing live script and cluster prerequisites are available,
remains explicitly opt-in through `npm run --prefix test test:promotion-live`. Neither live command
is part of `make test`.
