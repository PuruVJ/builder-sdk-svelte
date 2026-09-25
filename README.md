# @puruvj/builder-sdk-svelte

A drop-in replacement for [`@builder.io/sdk-svelte`](https://www.npmjs.com/package/@builder.io/sdk-svelte)
built for pages where Builder content is **big**: hundreds of kilobytes to megabytes of JSON per
request, rendered on every request.

It keeps the official SDK's public API and markup. It passes the official SDK's own end-to-end
suite: 10 more tests pass than with the official SDK, and no test that passes there fails here.
Server rendering is **170–300× faster** on production-shaped pages, with **~99.9% less memory
churn**. In the browser, hydration is **3–6× faster** with no main-thread blocking.

> **Status: experimental.** Built against `@builder.io/sdk-svelte@5.2.0` and Svelte 5. Visual
> editing and preview are handed to the official SDK (see [Editor](#editor-and-preview)).

```sh
npm install @puruvj/builder-sdk-svelte
```

---

## Why

The official Svelte SDK re-derives everything about a block every time its template reads
something. On a typical marketing page that means:

- **~100 `getProcessedBlock` calls per block per render.** Each one walks the block's entire
  `options` tree to resolve localized values (`traverse` creates a closure per value). Nested blocks
  inside options are walked again by every ancestor. On a 330 KB page that is **~1,500 full walks
  and ~1 million value visits per render. That's 92–94% of the whole render time.**
- **A full JSON clone of the block subtree** for every binding evaluation.
- **~9 components per block** (Block → StyleWrapper → BlockStyles → InlinedStyles, BlockWrapper →
  DynamicRenderer → ComponentRef → InteractiveElement → your component), each with reactive state.
- **One `<style>` tag per block**, plus ~9.5 KB of inline scripts per `<Content>`.
- **The component registry rebuilt per `<Content>`**, with a quadratic `reduce` and a
  function-serializing deep clone of every registered component's info.

At 20–300 ms of CPU and 150 MB–2 GB of garbage per page render, that adds up fast on a server that
renders every request.

## Numbers

Measured on an Apple M4 Max, Node 26, Svelte 5.57, `@builder.io/sdk-svelte@5.2.0`. Every
measurement runs in its own process. "Fresh" means a new content object per render (the app fetched
and parsed JSON), which is the real per-request case. Reproduce everything with the commands in
[Benchmarks](#benchmarks). The pages are synthetic but production-shaped: a handful of custom
components carrying large options, editor snapshots, tracking pixels and a personalization container
(`scripts/gen-fixtures.mjs`).

### Server: one whole page

Four `<Content>` roots per request (body, footer, accessibility toggle, support module), a
230-entry component list, Svelte 4-style app components:

| Page (JSON in) | Official p50 | Ours p50 | Speedup | Allocated / request | GC |
| --- | ---: | ---: | ---: | ---: | ---: |
| landing-small (129 KB) | 15.4 ms | 0.079 ms | **194×** | 90 MB → 0.21 MB | 0.39 → 0 ms |
| landing (280 KB) | 27.9 ms | 0.124 ms | **225×** | 182 MB → 0.29 MB | 0.56 → 0 ms |
| landing-large (519 KB) | 46.6 ms | 0.190 ms | **245×** | 321 MB → 0.45 MB | 0.78 → 0 ms |

On pages captured from a production site (kept local, see
[Testing with your own pages](#testing-with-your-own-pages)) the same whole-page render is
**122–294×** faster: 12–50 ms → 0.08–0.17 ms.

### Server: one `<Content>`, every scale

| Fixture | JSON | Official p50 | Ours p50 | Speedup | Official p99 | Ours p99 | Allocated / render | Cold first render |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| page-50k | 61 KB | 5.3 ms | 0.031 ms | 172× | 6.7 ms | 0.06 ms | 35 MB → 0.08 MB | 15 → 2.8 ms |
| page-250k | 267 KB | 23.0 ms | 0.087 ms | 264× | 25.4 ms | 0.16 ms | 158 MB → 0.17 MB | 35 → 3.2 ms |
| page-500k | 525 KB | 44.4 ms | 0.160 ms | 278× | 47.3 ms | 1.70 ms | 310 MB → 0.28 MB | 56 → 3.7 ms |
| page-1m | 983 KB | 83.5 ms | 0.311 ms | 268× | 86.3 ms | 2.07 ms | 582 MB → 0.58 MB | 93 → 4.4 ms |
| page-2m | 1.9 MB | 164 ms | 0.553 ms | 296× | 169 ms | 2.47 ms | 1.15 GB → 0.95 MB | 171 → 5.4 ms |
| page-4m | 3.9 MB | 311 ms | 1.169 ms | 266× | 317 ms | 3.46 ms | 2.3 GB → 1.9 MB | 332 → 6.1 ms |
| wide options (12 blocks) | 1.5 MB | 120 ms | 0.215 ms | 557× | 126 ms | 0.39 ms | 896 MB → 0.15 MB | 124 → 3.1 ms |
| flat, 1,000 blocks | 362 KB | 27.4 ms | 0.416 ms | 66× | 34.8 ms | 3.65 ms | 141 MB → 2.8 MB | 36 → 4.1 ms |
| flat, 5,000 blocks | 1.8 MB | 133 ms | 5.1 ms | 26× | 150 ms | 7.4 ms | 701 MB → 14 MB | 133 → 9.3 ms |
| 200 levels deep | 90 KB | 34.1 ms | 0.177 ms | 193× | 38.3 ms | 3.94 ms | 41 MB → 0.9 MB | 44 → 2.7 ms |

Rendering the **same** content object again (an app that caches its fetch) is cheaper still, because
every block's compiled record is reused: a whole captured production page then costs 0.092 ms,
against 37.8 ms for the official SDK.

For most pages the SDK is now cheaper than the `JSON.parse` of the content the app fetched (a 330
KB page parses in ~0.5 ms and renders in ~0.14 ms).

Server HTML is also 25–60% smaller: one stylesheet instead of a `<style>` per block, the A/B and
personalization scripts only when the content uses them, and no hydration markers inside plain
subtrees.

### Browser: hydration on a `csr = true` SvelteKit page

Chromium via Playwright, median of 5 cold loads. "Hydrated" is `performance.now()` at the page's
`onMount`. TBT counts main-thread blocking over 50 ms.

| Page | CPU | Official hydrated | Ours hydrated | Official TBT | Ours TBT | JS heap |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| landing (248 KB) | 1× | 87 ms | 24 ms | 0 ms | 0 ms | 3.6 → 2.4 MB |
| landing (248 KB) | 4× slower | 257 ms | 82 ms | 135 ms | **0 ms** | |
| page-1m | 1× | 257 ms | 51 ms | 86 ms | 0 ms | 6.5 → 3.3 MB |
| page-1m | 4× slower | 722 ms | 140 ms | 488 ms | **0 ms** | |
| page-2m | 1× | 470 ms | 76 ms | 197 ms | 0 ms | 8.7 → 4.2 MB |
| page-2m | 4× slower | 1,317 ms | 205 ms | 922 ms | **0 ms** | |
| flat, 1,000 blocks | 4× slower | 637 ms | 165 ms | 396 ms | 8 ms | 50 → 3.6 MB |

The SDK's client chunk is 29 KB over the wire (brotli), against 37.6 KB for the official SDK. On the
landing page the SDK's own code is ~5 ms of the page's 64 ms of main-thread work at 4× slowdown; the
rest is the browser and SvelteKit.

### Depth

| Nesting | Official | Ours |
| --- | --- | --- |
| Server render | fails below 400 levels | 20,000+ levels (no recursion in the plain path) |
| Browser hydration, plain blocks | stack overflow at ~55 levels | 700+ levels (beyond that, SvelteKit's own page-data serializer gives out first) |
| Browser hydration, live blocks (bindings at every level) | stack overflow below 60 levels | 150+ levels |

## Usage

It is the same API. Swap the import:

```svelte
<script>
  import { Content, isPreviewing, fetchOneEntry } from '@puruvj/builder-sdk-svelte';
</script>

<Content model="page" {content} apiKey={PUBLIC_BUILDER_KEY} customComponents={components} />
```

Or leave your imports alone and alias the package in `vite.config.js`. The alias is **exact-name**,
so `@builder.io/sdk-svelte/bundle/browser` still resolves to the official SDK for the editor:

```js
export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: [{ find: /^@builder\.io\/sdk-svelte$/, replacement: '@puruvj/builder-sdk-svelte' }]
  }
});
```

Keep `@builder.io/sdk-svelte` installed too if you use the Builder editor or preview: it is an
optional peer dependency, loaded only inside the editor.

### What's exported

`Content`, `Blocks`, the built-in blocks (`Button`, `Columns`, `Fragment`, `Image`, `Section`,
`Symbol`, `Text`), `isEditing`, `isPreviewing`, `fetchOneEntry`, `fetchEntries`,
`getBuilderSearchParams`, `setClientUserAttributes`, `track`, `_processContentResult`, the
registration no-ops (`register`, `registerAction`, `setEditorSettings`, `subscribeToEditor`) and the
types. It also includes built-in Accordion, Tabs, Video, Form (+ inputs), Custom Code, Embed,
Raw:Img, RawText and PersonalizationContainer, plus SSR A/B tests with the official inline variant
scripts.

### Tips for the fastest path

- **Keep your `customComponents` array stable** (a module constant, or memoized). The registry is
  cached by the array's identity. A fresh array per request still works, and building the registry
  is linear, but a stable one is free.
- **Reuse the content object when you can** (a cached fetch). Compiled blocks are cached per content
  object, so the second render of the same object skips all preparation.

## How it works

**Compile once, render many.** A block is compiled once per *plan* (one plan per content object ×
component list × model × locale × breakpoints) into a flat record: resolved component, merged and
localized options, wrapper attributes, CSS text, and compiled bindings, repeat, text templates and
actions. Localized values are resolved once per block. The walk stops at nested blocks and copies on
write only the objects it changes. Code strings are compiled once per process and cached. Bindings
apply through a copy-on-write path, never a whole-subtree clone. Every regex is hoisted.

**One walk over the content.** This is the only pass over the whole content's data. It uses an
explicit stack, so any depth works, and it does no per-object bookkeeping. It finds every reachable
block, including blocks nested in component options, and notes which blocks own localized values;
the rest skip that walk entirely. It also collects every static block's responsive CSS into a single
`<style>`.

**No component for a static block.** A static block (no bindings, repeat or animations, which is
nearly all of them) renders through a snippet and reads its compiled record once. Only blocks with
behaviour are component instances: bindings (`Bound`) and repeats (`Repeat`) get reactive state,
animations get a mount hook. A block picks its shape with a single dynamic `{@render}` rather than
an if/else chain, so nesting doesn't pile up effects.

**Plain subtrees are strings.** A subtree with no behaviour anywhere in it (no custom component, no
bindings, repeat, actions, animations or `{{state}}` text) renders as one `{@html}` string built by a
loop. Svelte never walks into it during hydration, since there is nothing live inside to find. It
costs no component, effect or hydration marker per block. A list's consecutive plain blocks are one
string too. The string follows Svelte's own SSR attribute rules, and a test checks it **byte for
byte** against the live path on every fixture.

## Compatibility

- **Official e2e suite** (`e2e/suite`, copied from BuilderIO/builder `packages/sdks-tests`, run
  against the official SvelteKit e2e app built twice): official **174 passed**, ours **184 passed**,
  **0 regressions**. The extra 10 are nested-symbol A/B variant SSR, which the official SDK fails.
- **Equivalence** (`tests/equivalence.test.ts`): every fixture rendered through both SDKs gives the
  same DOM tree, the same CSS rules and the same props reaching every custom component.
- **App shape** (`tests/app-shape.test.ts`): Svelte 4 components with `export let builderBlock`,
  `<Blocks>` for children and option arrays, `noWrap` roots spreading `attributes`, `builderContext`
  read as a store, built-ins registered with no component, and whole pages with several `<Content>`
  roots sharing one component list.
- Markup the official SDK emits and apps select on is kept: `.builder-blocks`, `.builder-block`,
  `builder-id`, `builder-model`, `builder-content-id`, `builder-path` / `builder-parent-id`, and
  `style data-id="builderio-block"`.

Known differences: the root no longer carries the official `style="display:undefined;"` quirk, and
the official SDK's per-`<Content>` default CSS and variant scripts are only emitted where the content
needs them.

### Editor and preview

When a page is opened inside the Builder editor or in preview, `<Content>` loads the official SDK
(`@builder.io/sdk-svelte/bundle/browser`, an optional peer dependency) and hands it the content. Live
editing therefore behaves exactly like the official SDK. Normal visitors never download it. An
in-house editor bridge is planned.

## Development

```sh
pnpm install
pnpm test            # generates fixtures, builds the bench bundle, runs every test
```

### Benchmarks

```sh
pnpm fixtures && pnpm bench:build
pnpm bench:app                 # whole pages, both SDKs (bench/results/app-page.json)
pnpm bench:ssr [ms] [filter]   # every fixture × fresh/same/cold (bench/results/ssr.json)

pnpm e2e:build                 # the SvelteKit e2e app, built once per SDK
pnpm bench:client pages__landing.pageContent gen__page-1m   # browser hydration, 1× and 4× CPU
```

### Official e2e suite

```sh
pnpm e2e:build
pnpm e2e:official
pnpm e2e:ours
```

### Testing with your own pages

`scripts/grab-real.mjs` captures pages of a live SvelteKit + Builder site with a headless browser.
`scripts/extract-kit-data.mjs` and `scripts/extract-contents.mjs` pull every Builder content out of
the captured SvelteKit data into `fixtures/real/`. That folder is **gitignored**: every test and
bench picks it up automatically when it exists, and your content stays on your machine.

## License

MIT © Puru Vijayvargia. Includes MIT-licensed code from [Builder.io's SDKs](https://github.com/BuilderIO/builder).
See [LICENSE](./LICENSE).
