# ${{ values.api_id }} API

This repository owns the complete OpenAPI contract in `specification.yaml`. Git is authoritative;
the Schema Registry contains validated, immutable publications of Git revisions.

## After Creation

1. Review and merge the API pull request in the parent System repository.
2. Wait for the API Application and initial publication PipelineRun to succeed.
3. Verify the commit-SHA version in the Schema Registry before selecting this API in a Component.

An API is consumable only after its initial publication succeeds. Components do not fall back to
Git or catalog content when the selected Registry artifact is absent.

## Release

The publication lifecycle is:

```text
commit on main
    -> immutable commit-SHA Registry publication

push vX.Y.Z tag
    -> immutable human Registry release vX.Y.Z
```

To create a stable API version that Components can select, tag the intended commit and push the
tag:

```bash
git tag -a v2.1.3 <commit> -m "Release v2.1.3"
git push origin v2.1.3
```

Release tags use `v<major>[.<minor>[.<patch>]][-<prerelease>]`. Tekton resolves the tagged commit,
publishes or finds its SHA version, and creates the distinct immutable Registry version such as
`v2.1.3`. Changing OpenAPI `info.version` updates contract metadata; it does not create a Registry
release.

## Contract

The repository was created from either an uploaded, self-contained OpenAPI YAML or JSON document,
or the golden path's minimal OpenAPI 3.1 scaffold. The golden path preserves uploaded content.
Spectral validates structure, metadata, operation identifiers, and platform governance before
publication.

Internal `#/...` references are supported. Relative references to files outside
`specification.yaml` are not.

## Registry Coordinates

| Coordinate | Value |
| --- | --- |
| Registry group | `${{ values.registryGroupId }}` |
| Registry artifact | `${{ values.api_id }}` |
| Registry API | `${{ values.schemaRegistryApiUrl }}` |

The Maven POM uses the official Apicurio Registry Maven plugin. The System-owned Pipeline validates
the initial revision and every later main push, then publishes a version named with the exact Git
commit SHA.

## Version Selection

| Selection | Behavior |
| --- | --- |
| `latest` | Follows the latest available Registry publication |
| Human release such as `v2.1.3` | Selects one immutable named release |
| Exact 40-character Git SHA | Selects one immutable commit publication |

Prefer a human release or exact SHA for repeatable Component builds. Use `latest` only when a
floating contract is intentional.

## Local Publication

Supply an explicit version and collision policy:

```bash
mvn io.apicurio:apicurio-registry-maven-plugin:3.2.5:register \
  -Dregistry.version=<registry-version> \
  -Dregistry.ifExists=FIND_OR_CREATE_VERSION
```

The repository contains no custom Registry client or downloaded CLI.
