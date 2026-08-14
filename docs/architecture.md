# Architecture and Git contracts

[Back to the repository overview](../README.md)

Contract-First IDP separates developer intent from platform implementation. This document explains
the responsibilities of Backstage, tenant repositories, Argo CD, and the runtime platform.

## Intent and implementation separation

The central design problem is how to give developers a short, safe path to production without
making Backstage the owner of production or exposing every infrastructure decision in a form.

`software-templates` owns the language of developer intent: catalog relationships, contracts,
repository structure, environment configuration, and release selections. `developer-charts` owns
the trusted interpretation of that intent on the cluster. Tenant Git is the stable interface
between them.

This split provides:

- **auditability:** creation, activation, promotion, and rollback become ordinary Git history;
- **least privilege:** Backstage writes Git but does not require Kubernetes credentials;
- **independent evolution:** developer experience and platform implementation can change on
  different schedules as long as their tested Git contract remains compatible;
- **recoverability:** reconciliation can retry from Git after Backstage has finished;
- **portability of intent:** tenant repositories describe what is wanted without embedding
  operator credentials or an arbitrary implementation repository.

Reconciliation is intentionally asynchronous. A successful Backstage task means the requested Git
change was created; Argo CD, Tekton, Registry, and image transport converge afterward. The
documentation and UI must make that transition visible.

## Design rationale

| Decision | Rationale |
| --- | --- |
| Use Git as the handoff | Backstage should capture intent and finish after creating a reviewable SCM change, not remain connected while several platform controllers complete their work. Git outlives the scaffolder task, provides audit and approval history, and lets reconciliation resume after transient failures. Backstage completion therefore confirms the Git change, not runtime readiness. |
| Keep API contracts independent | A contract is a product shared by providers and consumers, not an implementation detail of either side. Giving it a repository and release history allows parallel development, independent compatibility review, and explicit floating or immutable version selection. Backstage relationships remain unversioned, while each generated build configuration records the versions a Component selected. |
| Derive child ownership and SCM identity from the Domain | The Domain establishes the organization, repository host, and lifecycle for the tenant. Every tenant entity is owned by `group:default/domain-maintainers`, and repositories use the fixed organization teams. Reusing that information removes repetitive form choices and prevents a child entity from acquiring contradictory ownership or publishing outside the tenant's SCM scope. Moving an entity elsewhere is treated as an administrative migration rather than an ordinary golden-path option. |
| Encode lifecycle changes as small files | System activation, Component environment activation and release selection, and Resource provisioning are easier to review when each has one narrow file. ApplicationSets discover activation files directly; optional Component release files are merged into the already active Component Application. The paths remain a versioned, tested contract. |
| Keep release overlays artifact-only | A release file answers one question: which versioned artifact should run in this environment. Runtime configuration remains in common and environment values, so promotion cannot unexpectedly alter replicas, Routes, health checks, or Secret references. Rollback selects an older release without reverting unrelated configuration. |
| Compose existing Backstage action modules | GitHub actions handle repository operations, while RoadieHQ utility actions perform declarative contract transformations. This keeps the golden paths on maintained integrations and avoids project-specific action code with its own security and upgrade lifecycle. Organization administration and Git tag creation stay outside the templates because they require different privileges and are not safely covered by the available action set. |
| Keep Backstage out of the cluster | Repository credentials are sufficient for scaffolding and pull requests; giving the same process Kubernetes credentials would increase privilege and encourage imperative deployment steps. A platform administrator admits Domain entrypoints through cluster GitOps, after which Argo CD owns reconciliation. |
| Clone public tenant source anonymously for now | Anonymous clone keeps the current build path simple and avoids distributing source credentials into every tenant namespace. This is a tactical operating model rather than a general security claim: supporting private source requires an explicit credential-distribution and rotation design. |

## Catalog model

```mermaid
flowchart TD
    accTitle: Backstage catalog entity relationships
    accDescr: A Domain contains Systems. Each System contains APIs, Components, and Resources, while APIs are provided or consumed by Components.
    domain[Domain] --> systemA[System]
    domain --> systemB[System]
    systemA --> api[API]
    systemA --> component[Component]
    systemA --> resource[Resource]
```

A Domain is the tenant and lifecycle authority. Systems group application capabilities inside that
Domain. APIs define communication contracts independently; Components implement or consume them;
Resources represent managed dependencies. Catalog relationships are intentionally unversioned,
while each Component's generated Maven or Node build configuration records its reviewable contract
versions.

Every entity-producing repository stores its primary descriptor at `/catalog-info.yaml`. Golden
paths immediately register that file, while the App-scoped GitHub provider independently discovers
the same root convention across installed organizations for broad discovery and recovery.

The API, Component, and Resource nodes are peers under a System. Their provider and consumer
relationships are catalog metadata, not another containment level.

## Sources of truth

| Concern | Source of truth | Who changes it |
| --- | --- | --- |
| Catalog topology and ownership | Generated `catalog-info.yaml` files | Backstage golden paths and repository owners |
| Domain environment order | Domain entity | Domain maintainers |
| System activation | Domain repository | System creation or activation pull request |
| API, Component, release, and Resource intent | System repository | Entity creation or promotion pull request |
| API contract | API repository `specification.yaml` | API owners |
| Component implementation | Component repository | Component owners |
| Platform implementation | `developer-charts` | Platform engineers |
| Runtime resources | Argo CD-rendered desired state | Controllers; never edited directly |

## Reconciliation

```mermaid
flowchart TD
    accTitle: Tenant and platform state reconciliation
    accDescr: Backstage creates tenant Git state while platform engineers maintain trusted charts. Argo CD combines both sources, discovers active Systems and their desired state, and reconciles leaf resources on OpenShift.

    backstage[Backstage golden paths]
    platformTeam[Platform engineers]
    tenantGit["Tenant Git repositories<br/>Domain, System, API, Component, Resource"]
    chartGit["developer-charts repository<br/>trusted Helm implementations"]

    backstage -->|Create repositories and pull requests| tenantGit
    platformTeam -->|Version platform behavior| chartGit

    subgraph argo["Argo CD reconciliation"]
        direction TD
        combine["At each layer<br/>combine tenant values with a trusted chart"]
        domain["Domain layer<br/>select an environment and discover active Systems"]
        system["System layer<br/>discover APIs, Component state, releases, and Resources"]
        leaf["Leaf layer<br/>render Pipelines, registry infrastructure, workloads, and Resources"]
        combine --> domain
        domain -->|Create System Applications| system
        system -->|Create leaf Applications| leaf
    end

    tenantGit -->|Desired state and values| combine
    chartGit -->|Domain, System, and leaf charts| combine
    leaf --> cluster["OpenShift<br/>Tekton, Quay, Schema Registry, and operators"]
```

The two inputs have different owners and purposes. Tenant Git selects desired state; the
`developer-charts` repository supplies trusted implementations and infrastructure integration.
Argo CD combines them without copying either source into the other.

Each layer creates Argo CD Applications for the next layer. The charts do not invoke one another
directly:

| Reconciliation layer | Reads | Produces |
| --- | --- | --- |
| Domain | Domain lifecycle, selected environment, System activation files, and the Domain chart | One System Application for each active System |
| System | System desired-state files, environment policy, and the System chart | API, one Application per Component environment, and Resource Applications |
| Leaf | Entity-specific values and the corresponding trusted chart | Tekton, registry, workload, and managed-Resource objects on OpenShift |

No chart writes back to Git.

Domain and System repositories are inputs to Git-backed ApplicationSet generators. Their golden
paths therefore add push webhooks to both the Argo CD server and ApplicationSet controller using
the endpoints inherited from the PlatformTarget. Polling remains the fallback. API and Component
Tekton webhooks remain separate, and leaf source repositories do not receive these GitOps hooks.

## Git discovery contracts

File presence is a deliberate API between the templates and charts.

### Domain repository

| Path | Meaning when present | Meaning when absent |
| --- | --- | --- |
| `systems/<system>/environments/<environment>.yaml` | Activate the System in that Domain environment | The System is not attached there |

### System repository

| Path | Responsibility |
| --- | --- |
| `apis/<api>/values.yaml` | Configure validation and Schema Registry publication |
| `components/<component>/values.yaml` | Hold team-owned values shared across environments |
| `components/<component>/environments/<environment>.yaml` | Create one OpenJDK Component Application, its ImageStream, and environment configuration |
| Optional `components/<component>/releases/<environment>.yaml` | Select one runtime artifact; workload resources require this `image.tag` |
| `resources/<profile>/<resource>/values.yaml` | Hold common Resource intent |
| `resources/<profile>/<resource>/environments/<environment>.yaml` | Provision the Resource in that environment |

A Component release file contains only the artifact selection:

```yaml
image:
  tag: v1.7.3
```

Promotion never rewrites replicas, Routes, resource requests, health checks, or Secret references.
Rollback selects an older release tag through the same reviewable mechanism.

The build-environment release may select `latest`; promoted environments use human release tags.
There is no separate Component infrastructure Application.

## Environment lifecycle

The Domain declares a build environment and an ordered lifecycle. Promotion always moves between
adjacent environments.

```mermaid
flowchart TD
    accTitle: Ordered environment lifecycle
    accDescr: The dev build environment promotes to test, and test promotes to prod.
    dev["dev<br/>build and source integration"] --> test[test]
    test --> prod["prod<br/>no namespace suffix"]
```

Environment names are configuration, not hard-coded platform concepts. The first ordered
environment must be the build environment. System activation and Component promotion reject
undeclared and build-environment targets, but the forms do not currently enforce uniqueness or
adjacent selection. Reviewers must preserve the declared order. The golden-path default is `dev`,
`test`, `prod`, with `dev` as build and an empty namespace suffix for `prod`.

## API lifecycle

Git remains the authoritative API contract source. The API golden path accepts a self-contained
OpenAPI YAML or JSON document or creates a minimal OpenAPI 3.1 scaffold. It preserves uploaded
contract content without attempting contract governance in Backstage. Spectral owns validation in
the API publication Pipeline.

```mermaid
flowchart TD
    accTitle: API contract publication lifecycle
    accDescr: Main commits are validated and published under their Git SHA. Human tags resolve the same commit and publish an additional immutable human Registry version.
    main[Commit on main] --> spectral[Spectral quality gate]
    spectral --> sha["Publish Apicurio version<br/>exact Git SHA"]
    tag["Human Git tag, for example v2.1.0"] --> taggedCommit[Resolve tagged commit]
    taggedCommit --> ensureSha[Publish or find SHA version]
    ensureSha --> release["Publish immutable human version<br/>v2.1.0"]
```

An Argo CD Sync hook publishes the initial revision. Webhooks invoke the same Tekton Pipeline for
later pushes and release tags. `info.version` is contract metadata; Git tags declare releases.

Generated Components retrieve selected contracts from Apicurio:

| Selection | Scaffolding source | Build behavior | Reproducibility |
| --- | --- | --- | --- |
| `latest` | Apicurio `branch=latest` content | Follows the latest available publication | Floating |
| Human release, such as `v2.1.0` | Exact Apicurio version | Downloads that immutable Registry version | Repeatable |
| Exact 40-character Git SHA | Exact Apicurio version | Downloads that immutable Registry version | Repeatable |

Java profiles use the official Apicurio Maven plugin. Each selected API gets its own
namespace-qualified local contract filename and `openapi.client.<alias>.host` property. Camel
profiles generate dormant, API-qualified `direct:` routes when operation IDs are available;
contracts without operation IDs still receive download, host, catalog, and developer-documentation
wiring.

The Node.js profile downloads selected contracts into `contracts/` and uses `openapicmd` to
generate TypeScript server and client types under `src/generated/`. Its Express service uses
`openapi-backend` for provider-side routing and validation and `openapi-client-axios` for typed
consumer clients. A consumed API's generated default URL can be overridden with
`OPENAPI_CLIENT_<ALIAS>_URL`, where the alias is uppercased and non-alphanumeric characters become
underscores.

Contract consumption works across Systems in v1. Runtime endpoint resolution remains
environment-owned configuration: operators can supply the override above instead of the generated
default. The platform does not automatically discover a runtime endpoint from catalog or contract
metadata.

Camel implementation skeletons use `missingOperation("mock")` (or the YAML DSL equivalent), so
unimplemented OpenAPI operations return Camel's contract-shaped mock behavior while development is
in progress.

## Component build, release, and promotion

The default and recommended implementation is **Quarkus Camel OpenAPI with Java DSL**. The
Component form presents the profiles in this order:

| Priority | Implementation profile | Intended use |
| ---: | --- | --- |
| 1 | Quarkus Camel OpenAPI — Java DSL | Recommended default for Camel-based API implementations |
| 2 | Quarkus Camel OpenAPI — YAML DSL | Quarkus when declarative routes are preferred |
| 3 | Spring Boot Camel OpenAPI — Java DSL | Spring Boot applications that require Camel |
| 4 | Spring Boot OpenAPI | Spring Boot applications without Camel route scaffolding |
| 5 | Node.js OpenAPI | Node 24, Express, OpenAPI request validation, and generated TypeScript clients/types |

The template resolves developer choices into one platform build profile: Quarkus selects
`quarkus-jvm` or `quarkus-native`, both Spring implementations select `spring-boot`, and Node
selects `nodejs`. Generated System desired state contains only `build.profile`; trusted chart code
owns builders, commands, Dockerfile paths, and runtime defaults. Java profiles target Java 21 and
include a Maven wrapper. Node targets Node 24 with a locked npm install. Main commits are built
once; releases and promotions move immutable digests rather than rebuilding source.

```mermaid
flowchart TD
    accTitle: Component build, release, and promotion lifecycle
    accDescr: Main commits produce commit images. Human Git tags alias the same digest, and promotion copies that immutable digest to the next environment repository.
    commit[Main commit] --> package[Maven package]
    package --> commitImage["Quay image<br/>git-&lt;sha&gt;"]
    commitImage --> latest[Build-environment latest alias]
    releaseTag["Git tag v1.7.3"] --> resolve[Resolve tagged commit]
    commitImage --> alias["Create v1.7.3<br/>on the same digest"]
    resolve --> alias
    alias --> desired[Promotion pull request selects v1.7.3]
    desired --> copy[Copy digest to next environment repository]
    copy --> runtime[Target runtime converges]
```

A human Component tag can be created with:

```bash
git tag -a v1.7.3 <commit> -m "Release v1.7.3"
git push origin v1.7.3
```

Release materialization is asynchronous and does not alter System desired state. Promotion is a
separate pull request. The shared digest guard rejects moving an existing human tag to a different
artifact. A target Deployment may briefly report `ImagePullBackOff` while the promotion
Pipeline copies the image; Kubernetes retries until the digest-checked target-local tag is
available.

## Repository ownership and SCM separation

| Fixed GitHub team | Repository permission |
| --- | --- |
| `domain-maintainers` | `maintain` |
| `domain-contributors` | `push` |
| `domain-viewers` | `pull` |

All generated repositories use these teams. The organization and teams must exist and the CF-IDP
GitHub App must be installed before onboarding. The templates never create teams. Domains within
one organization share the same role populations; separate organizations are the current tenancy
boundary for independent populations.

Generated entities use canonical annotations:

```yaml
metadata:
  annotations:
    contract-first-idp.github.io/scm-provider: github
    contract-first-idp.github.io/scm-host: github.com
    contract-first-idp.github.io/domain-org: tenant-org
    contract-first-idp.github.io/domain-repo: tenant-domain
    contract-first-idp.github.io/repository-name: repository-name
```

The provider, host, organization, and Domain repository annotations identify the tenant SCM
context. Child entities store only their repository-name segment; templates assemble clone URLs
and provider-specific action inputs only when needed.

Platform and tenant repositories can use separate hosts and visibility:

| Repository group | Typical repositories | Access model |
| --- | --- | --- |
| Platform | `software-templates`, `developer-charts` | Public or private; platform services need read access |
| Tenant GitOps | `<domain>-domain`, `<system>-system` | Generated public with team write access |
| Tenant source | API, Component, and Resource repositories | Generated public; Tekton clones anonymously |

Domain annotations locate tenant repositories. `spec.platformTarget` selects a catalog Resource;
the target supplies the platform repository, chart, router, and Schema Registry coordinates.

## Security and trust model

- **Public repository defaults:** All generated tenant repositories are public. The default branch
  requires pull-request changes, blocks force-push and deletion, and enforces protection for
  administrators, without required approvals or status checks yet. Team grants establish write
  responsibility but do not restrict read access. Tekton receives no tenant Git credential, so
  private API and Component source requires a credential-distribution design.
- **Reviewed cluster admission:** Backstage does not receive cluster credentials. It opens an
  append-only platform pull request and Argo CD reconciles it after review and merge.
- **Unsigned lab webhooks:** EventListener signature verification is not yet implemented. Treat
  public webhook Routes as development or lab integrations.
- **Promotion safeguards:** Cross-environment promotion refuses a target tag that already points to
  another digest. Build-environment release materialization does not perform the same preflight
  check, so human tags require external immutability policy.
- **Platform-controlled implementations:** Resource declarations select a supported profile and
  chart path but cannot redirect Argo CD to an arbitrary repository or revision.
- **Permissive AppProjects:** Generated projects currently organize ownership. Authorization
  hardening remains separate platform work.

## Related documentation

- [Bootstrap a tenant](getting-started.md)
- [Development and testing](development.md)
- In the companion `developer-charts` repository: `docs/architecture.md` and
  `docs/platform-requirements.md`
