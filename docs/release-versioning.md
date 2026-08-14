# Release policy

`software-templates` is independently versioned and owns golden paths and generated repository
contracts. It consumes both upstream contracts through root `release.yaml`:

```yaml
version: 1.0.0
requires:
  platformComponents: ">=1.0.0 <2.0.0"
  developerCharts: ">=1.0.0 <2.0.0"
```

A patch fixes implementation behavior and must preserve both ranges exactly. A minor adds capability
and may raise either minimum. A major is an incompatible golden-path contract change. A template
patch does not require another repository release when existing ranges already include it.

Compatibility metadata is release policy, not platform runtime machinery. Golden paths do not
inject a custom compatibility action. `make release-compatibility-check` compares the three sibling
`release.yaml` candidates without changing the platform architecture.

## Release procedure

1. Choose SemVer from changes to the golden-path contract.
2. Update `release.yaml`.
3. Run `make release-check`.
4. Run `make release-compatibility-check` with intended sibling candidates.
5. Commit and push.
6. Create and push the exact `vX.Y.Z` tag.
7. Verify tag CI.
8. Select the new exact tag in platform configuration when desired.

The validator uses `node-semver`, requires tag/version equality and monotonic versions, and rejects
patch dependency changes.
