# Changesets

Every pull request that changes what the package does adds a changeset:

```sh
pnpm changeset
```

Pick the bump (patch: a fix; minor: a feature, or a change in behaviour while we are on 0.x) and
write one or two lines for the changelog. On merge to `main`, the release workflow opens (or
updates) a "Version Packages" pull request; merging that publishes to npm.
