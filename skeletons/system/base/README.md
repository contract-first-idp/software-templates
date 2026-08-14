# ${{ values.systemName }} System

This repository owns the `${{ values.systemName }}` System catalog identity and its environment
desired state for APIs, Components, and Resources. The parent Domain repository separately selects
the environments in which this System is active.

## After Creation

1. Review and merge the activation pull request in the parent Domain repository.
2. Wait for the System Application and namespace to become healthy in the build environment.
3. Use the API, Component, and Resource golden paths to add application capabilities.

## Desired State

| Path | Responsibility |
| --- | --- |
| `catalog-info.yaml` | System identity, Domain relationship, owner, and group ID |
| `apis/<api>/values.yaml` | OpenAPI validation and Schema Registry publication |
| `components/<component>/values.yaml` | Build and Component values shared across environments |
| `components/<component>/environments/<environment>.yaml` | Environment runtime configuration and registry infrastructure |
| `components/<component>/releases/<environment>.yaml` | Desired Component release for that environment |
| `resources/<profile>/<resource>/values.yaml` | Common managed-Resource configuration |
| `resources/<profile>/<resource>/environments/<environment>.yaml` | Environment Resource configuration and provisioning signal |

File presence is meaningful. A Component may have configuration before a release is selected, and
a Resource is provisioned only where its environment file exists.

## Release Selection and Promotion

The file below selects the desired Component release for one environment:

```text
components/<component>/releases/<environment>.yaml
```

Use **Promote Component** in Developer Hub to change it. The workflow opens a pull request to this
repository; after merge, Argo CD reconciles the selection and the platform copies the immutable
image digest into the next environment. Rollback selects an older release through the same
workflow.

The Component repository builds source and creates a human release. This System repository only
selects which existing release belongs in an environment. Release files should contain only
`image.tag`; keep replicas, Routes, resources, health checks, environment variables, and Secret
references in common or environment values.

## Safe Changes

- Put shared behavior in `components/<component>/values.yaml`.
- Put environment-specific behavior in the matching environment file.
- Use promotion pull requests for release selection and rollback.
- Use the Resource golden path to add supported managed dependencies.

Argo CD layers common, environment, and release values without rewriting team-owned configuration.
