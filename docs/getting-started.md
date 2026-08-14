# Bootstrap a tenant

[Back to the repository overview](../README.md)

The platform team first registers one or more Backstage `Resource` entities whose `spec.type` is
`contract-first-idp-target`. Each authoritative target publishes its runtime configuration under
`spec.platform`, including the mutable configuration repository and branch, tenant-admission path,
runtime endpoints, and immutable dependency versions. Templates consume the fetched entity directly.

Before running a golden path, verify that the target GitHub organization already exists, the
CF-IDP GitHub App is installed in it, and the fixed `domain-maintainers`, `domain-contributors`, and
`domain-viewers` teams exist. The templates grant those teams `maintain`, `push`, and `pull`
respectively; they do not create teams. Multiple Domains in one organization intentionally share
those role populations. Use separate GitHub organizations when independent populations are
required.

Then run **Create Tenant Domain** and provide identity, a platform target, an ordered lifecycle,
the first/build environment, and namespace suffixes.

The golden path:

1. creates and registers the portable `<domain>-domain` repository;
2. leaves its `systems/` structure empty and stores no cluster endpoint;
3. opens one append-only pull request to the selected platform repository containing only
   `tenants/<domain>/project.yaml` and `tenants/<domain>/application.yaml`.

Merge that platform pull request. The generic `tenant-admissions` Application creates the
per-Domain admission project and parent Application. That parent combines Domain policy with the
target-owned runtime values and renders the Domain chart once. One System discovery
ApplicationSet is created for every ordered environment.

The Domain repository receives push webhooks for both the Argo CD server and ApplicationSet
controller. Normal Git polling remains the recovery path.

Run **System Golden Path** next. Its activation pull request adds
`systems/<system>/environments/<build>.yaml`. Add later environment files through **Activate System
Environment**; no platform repository change is needed.
The System repository receives the same two GitOps push webhooks because its contents drive leaf
ApplicationSets.

The target reference reserves a future placement seam, but environment-level multi-cluster
placement is not implemented in `v1.0.0`.
