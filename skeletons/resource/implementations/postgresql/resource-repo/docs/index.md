# ${{ values.resourceName }}

`${{ values.resourceName }}` is a PostgreSQL database Resource in the
`${{ values.systemName }}` System. It is owned by `${{ values.owner }}`.
Its standard desired state uses PostgreSQL ${{ values.postgresVersion }} and sets the instance
replica count to ${{ values.replicaCount }}.

## Current implementation

The Resource selects the platform-standard `postgresql` profile at
`charts/resource/postgresql`. The platform supplies the physical implementation repository and revision;
they are intentionally absent from tenant Resource desired state.

Common deployment values and explicit environment activation files live in the
[parent System repository](${{ values.systemRepoWebUrl }}) under
`resources/postgresql/${{ values.resourceName }}/`.

## Connection and credentials

Each environment creates a `PostgresCluster` named
`${{ values.resourceName }}-<environment>` in the System namespace. The Crunchy Postgres Operator
publishes connection data for `${{ values.userName }}` in the Secret named
`${{ values.resourceName }}-<environment>-pguser-${{ values.userName }}`.
The operator populates `host`, `port`, `dbname`, `user`, `password`, `uri`, and `jdbc-uri` keys.

Confirm the generated objects before wiring an application:

```bash
oc get postgrescluster ${{ values.resourceName }}-<environment> -n <system-namespace>
oc get secret ${{ values.resourceName }}-<environment>-pguser-${{ values.userName }} \
  -n <system-namespace>
```

Consume the operator-managed Secret through the Component's runtime Secret integration. Do not copy
credential values into Git or this Resource repository. See the
[Crunchy Postgres Operator user-management guide][pgo-users] for the Secret contract.

## Repository responsibilities

The [Resource repository](${{ values.repoWebUrl }}) owns the Resource catalog identity, TechDocs,
and the stable extension point for a future Resource-specific implementation. The System
repository owns environment composition, configuration values, and selection of the implementation
source.

The standard implementation intentionally generates no chart here. If this Resource later needs
to diverge, a platform-managed profile can select another implementation path without persisting
platform SCM coordinates in this tenant repository.

[pgo-users]: https://access.crunchydata.com/documentation/postgres-operator/latest/architecture/user-management/
