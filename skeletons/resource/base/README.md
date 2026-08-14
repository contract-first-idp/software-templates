# ${{ values.resourceName }}

This repository represents the `${{ values.resourceName }}` Resource in the
`${{ values.systemName }}` System. It uses the `${{ values.profile }}` implementation profile and
owns the Resource catalog identity and Resource-specific operational documentation.

## After Creation

1. Review and merge the Resource pull request in the parent System repository.
2. Wait for the Resource Application and operator-managed resource to become healthy.
3. Read [Resource operations](docs/index.md) for the generated object names, connection data, and
   credential discovery commands.

## Configuration and Ownership

| Concern | Owner and location |
| --- | --- |
| Resource identity and operations | This repository: `catalog-info.yaml` and `docs/index.md` |
| Common configuration | Parent System: `resources/${{ values.profile }}/${{ values.resourceName }}/values.yaml` |
| Environment configuration and provisioning | Parent System: `resources/${{ values.profile }}/${{ values.resourceName }}/environments/<environment>.yaml` |
| Physical implementation | Platform-owned chart selected by the `${{ values.profile }}` profile |

The platform owns the implementation chart and operator integration. The application team owns the
reviewed common and environment values in the System repository. Do not store connection
credentials in Git; discover the operator-managed Secret using the commands and naming contract in
[Resource operations](docs/index.md).
