# ${{ values.componentName }}

${{ values.description }}

| Attribute | Value |
| --- | --- |
| System | `${{ values.systemRef }}` |
| Implementation profile | `${{ values.implementationProfile }}` |
| Approved build profile | `${{ values.buildProfile }}` |
| Build service | Tekton/OpenShift Pipelines |
| Schema Registry API | `${{ values.schemaRegistryApiUrl }}` |

This repository owns implementation source and developer tooling. Runtime and build desired state
live under this Component in the parent System repository. Tekton clones this public repository
without a Git write credential.

## After Creation

1. Review and merge the Component pull request in the parent System repository.
2. Wait for the Component environment, runtime, and initial build to become healthy.
3. Confirm that the `git-<full-commit-sha>` image exists before creating a human release.

## Release and Promotion

```text
push to main
    -> build git-<full-sha>

push vX.Y.Z tag
    -> attach the human release tag to the existing image digest

Promote Component in Developer Hub
    -> update the desired release in the next environment
```

Create a release by tagging a commit that has already built successfully:

```bash
git tag -a v1.7.3 <commit> -m "Release v1.7.3"
git push origin v1.7.3
```

Creating the Git tag does not rebuild the Component. Release materialization resolves the
commit's existing `git-<full-sha>` image and adds the human tag to that digest. It is asynchronous;
wait for the tag to appear in Quay.

Creating a release does not promote an environment. After materialization succeeds, run
**Promote Component** in Developer Hub. That workflow opens a pull request to update
`components/${{ values.componentName }}/releases/<environment>.yaml` in the parent System
repository. Merging it selects the release for the next environment and starts target-local image
promotion. To roll back, select an older release through the same workflow.

The shared release guard permits an absent human tag or one already resolving to the same digest;
it rejects attempts to move an existing tag to a different artifact.

## Local Development

Use the checked-in implementation tooling so local and pipeline builds share project configuration.
Java profiles provide the Maven wrapper (`./mvnw test`); the Node.js profile uses reproducible npm
commands (`npm ci && npm test`). The `.devfile.yaml` provides the matching editor and workspace
entrypoint.

{%- if values.implementationProfile == 'nodejs-openapi' %}
The Node.js service uses Express and `openapi-backend` for HTTP routing and contract validation,
`openapi-client-axios` for generated typed consumers, `openapicmd` for TypeScript type generation,
and the built-in `node:test` runner. `npm test` generates contracts and types, compiles the project,
and runs the compiled tests.
{%- endif %}

## Runtime Configuration

Runtime configuration is owned in the parent System repository:

| Path | Purpose |
| --- | --- |
| `components/${{ values.componentName }}/values.yaml` | Build and shared Component intent |
| `components/${{ values.componentName }}/environments/<environment>.yaml` | Replicas, Route, health checks, resources, environment variables, and Secrets |
| `components/${{ values.componentName }}/releases/<environment>.yaml` | Selected image tag only |

Keep runtime configuration out of release files so promotion and rollback change only the
artifact selection.

## API Dependencies

The generated build configuration records each selected contract and downloads it from the Schema
Registry. The selection behavior is the same across implementation profiles:

| Selection | Build behavior |
| --- | --- |
| `latest` | Follows the latest available Registry publication |
| Human release tag | Downloads the matching immutable Registry version |
| Exact Git SHA | Downloads the matching immutable commit publication |

`latest` can change a generated model without a Component source change. Prefer a release or SHA
for repeatable builds. Missing Registry artifacts fail the build without falling back to Git or
catalog content.

{%- if values.implementationProfile == 'nodejs-openapi' %}
Node.js builds download contracts into `contracts/`. `openapicmd` generates the provided API's
server types and each consumed API's client types under `src/generated/`; generated typed client
factories live in `src/generated/clients.ts`.
{%- else %}
Java builds download contracts during Maven `initialize` and write them under
`target/generated-resources/openapi`.
{%- endif %}

{%- if values.provided_api %}
## Provided API

| Attribute | Value |
| --- | --- |
| Catalog reference | `${{ values.provided_api.ref }}` |
| Registry group | `${{ values.provided_api.registry_group_id }}` |
| Registry artifact | `${{ values.provided_api.registry_artifact_id }}` |
| Selected version | `${{ values.provided_api.version }}` |
{%- if values.implementationProfile == 'nodejs-openapi' %}
| Local contract | `contracts/provided-api.yaml` |
| Generated types | `src/generated/provided-api.d.ts` |
{%- else %}
| Local contract | `target/generated-resources/openapi/${{ values.provided_api.contract_file }}` |
{%- endif %}
{%- endif %}

## Consumed APIs

{%- if values.consumed_apis | length > 0 %}
{%- for api in values.consumed_apis %}
### `${{ api.ref }}`

| Attribute | Value |
| --- | --- |
| Registry group | `${{ api.registry_group_id }}` |
| Registry artifact | `${{ api.registry_artifact_id }}` |
| Selected version | `${{ api.version }}` |
{%- if values.implementationProfile == 'nodejs-openapi' %}
| Local contract | `contracts/${{ api.alias }}.yaml` |
| Generated client types | `src/generated/clients/${{ api.alias }}.d.ts` |
| Runtime URL override | `OPENAPI_CLIENT_${{ api.alias | upper | replace('-', '_') }}_URL` |
| Generated default URL | `http://${{ api.name }}:8080` |
{%- else %}
| Local contract | `target/generated-resources/openapi/${{ api.contract_file }}` |
| Default host property | `openapi.client.${{ api.alias }}.host=http://${{ api.name }}:8080` |
{%- endif %}

{%- if values.implementationProfile != 'nodejs-openapi' %}
{%- if api.operations | length > 0 %}
Generated operation entry points:

{%- for operation in api.operations %}
- `${{ operation.method | upper }} ${{ operation.path }}` routes to
  `direct:${{ api.alias }}.${{ operation.operation_id }}`
{%- endfor %}
{%- else %}
No operation-specific routes were generated. Use the contract's operation IDs when adding routes.
{%- endif %}
{%- endif %}

{%- endfor %}
{%- else %}
This Component does not currently consume an API.
{%- endif %}

Cross-System contract consumption is supported in v1. Runtime endpoint resolution is owned by
environment configuration and may override the generated default shown above. CF-IDP does not
automatically discover runtime endpoints from catalog or contract metadata.
