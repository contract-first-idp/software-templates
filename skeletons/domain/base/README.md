# ${{ values.title }}

`${{ values.domainName }}` is the tenant Domain owned by
`group:default/domain-maintainers`. This repository owns the Domain's catalog identity, ordered
environment lifecycle, build-environment designation, and System activation files.

The Domain is attached to `${{ values.platformTarget }}`. That platform target supplies trusted
cluster, router, Schema Registry, Quay, Argo CD, chart, SCC, and cluster-local Secret coordinates;
they do not belong in this repository.

## After Creation

The golden path publishes this repository, registers `catalog-info.yaml`, and opens a platform
admission pull request. After that pull request merges, Argo CD attaches the Domain to the target,
renders the Domain chart, and creates System discovery controllers for the ordered environments.

## Environments

`${{ values.buildEnvironment }}` is the build environment and must remain first.

| Environment | Namespace suffix |
| --- | --- |
{% for environment in values.environments -%}
| `${{ environment.name }}` | `${{ environment.namespaceSuffix | default("none", true) }}` |
{% endfor %}
The target reference keeps tenant lifecycle policy separate from target-specific runtime
configuration and permits attachment to another compatible target.

## System Activation

A System is active in an environment when this file exists:

```text
systems/<system>/environments/<environment>.yaml
```

The **System Golden Path** creates the build-environment activation. Use **Activate System
Environment** in Developer Hub for later environments; it opens a pull request that adds the next
activation file. Merging that pull request is the lifecycle operation that activates the System.

This repository selects where a System is active. Component and API release workflows remain in
their respective repositories and the System desired-state repository.

## Repository Contract

| Path | Responsibility |
| --- | --- |
| `catalog-info.yaml` | Domain identity, owner, target reference, group ID, and lifecycle policy |
| `systems/<system>/environments/<environment>.yaml` | Activate one System in one environment |

The generated repository is public by default and protects `main` for pull-request changes,
force-push prevention, deletion prevention, and administrator enforcement. The GitHub organization
must already contain the standard Domain teams and have the CF-IDP GitHub App installed.
