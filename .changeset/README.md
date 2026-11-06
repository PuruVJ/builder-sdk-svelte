# Changesets

This package is a fork of `@builder.io/sdk-svelte@5.2.0`, and its versions say so: `5.2.0-fork.N`,
where N is our release number. That is changesets' pre-release mode with the tag `fork`
(`.changeset/pre.json`) — leave it in: every release bumps only N.

Every pull request that changes what the package does adds a changeset:

```sh
pnpm changeset
```

Pick **patch** or **minor** (both give the next `5.2.0-fork.N`; minor for a feature or a change in
behaviour, patch for a fix) and write one or two lines for the changelog. Never **major**: that would
leave the official base (`6.0.0-fork.N`).

## Rebasing on a newer official release (say 5.4.0)

In one pull request:

1. `@builder.io/sdk-svelte` in devDependencies → `5.4.0`, then `pnpm install` (the parity tests now
   run against it).
2. `node scripts/vendor-official-types.mjs` (the official types this package exports).
3. `SDK_VERSION` in `src/lib/internal/track.ts` → `'5.4.0'` (what the editor and the API are told).
4. `version` in package.json → `5.4.0-fork.<the last N>` (N keeps counting: it is our release number).
5. `pnpm test`, and port whatever the new official release changed until it is green.
6. `pnpm changeset` (minor): "Rebased on @builder.io/sdk-svelte 5.4.0".

The next release is then `5.4.0-fork.<N + 1>`. `tests/unit/fork-version.test.ts` fails until steps
1–4 agree.

On merge to `main`, the release workflow opens (or updates) a "Version Packages" pull request;
merging that publishes to npm (trusted publishing, as `latest`) and tags `v<version>`.
