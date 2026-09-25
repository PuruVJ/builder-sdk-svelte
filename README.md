# @puruvj/builder-sdk-svelte

A drop-in replacement for [`@builder.io/sdk-svelte`](https://www.npmjs.com/package/@builder.io/sdk-svelte)
built for pages where Builder content is **big**: hundreds of kilobytes to megabytes of JSON per
request, rendered on every request.

It keeps the official SDK's public API and markup. It passes the official SDK's own end-to-end
suite: 10 more tests pass than with the official SDK, and no test that passes there fails here.
Server rendering is **60–110× faster** on production-shaped pages, with **~99% less memory
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
| landing-small (129 KB) | 15.0 ms | 0.19 ms | **78×** | 90 MB → 0.40 MB | 0.42 → 0 ms |
| landing (280 KB) | 27.2 ms | 0.35 ms | **79×** | 182 MB → 0.67 MB | 0.64 → 0 ms |
| landing-large (519 KB) | 45.8 ms | 0.61 ms | **75×** | 321 MB → 1.2 MB | 0.82 → 0 ms |

### Server: one `<Content>`, every scale

| Fixture | JSON | Official p50 | Ours p50 | Speedup | Official p99 | Ours p99 | Allocated / render | Cold first render |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| page-50k | 61 KB | 5.6 ms | 0.09 ms | 63× | 6.8 ms | 0.24 ms | 35 MB → 0.16 MB | 16 → 3 ms |
| page-250k | 267 KB | 23.4 ms | 0.32 ms | 72× | 26.2 ms | 1.98 ms | 158 MB → 0.54 MB | 37 → 5 ms |
| page-500k | 525 KB | 47.9 ms | 0.61 ms | 79× | 49.3 ms | 2.35 ms | 311 MB → 0.94 MB | 56 → 5 ms |
| page-1m | 983 KB | 85.4 ms | 1.18 ms | 73× | 89.0 ms | 2.87 ms | 582 MB → 2.0 MB | 93 → 6 ms |
| page-2m | 1.9 MB | 163 ms | 2.2 ms | 74× | 169 ms | 4.2 ms | 1.15 GB → 3.4 MB | 173 → 9 ms |
| page-4m | 3.9 MB | 308 ms | 4.6 ms | 67× | 312 ms | 7.2 ms | 2.3 GB → 7.2 MB | 330 → 13 ms |
| wide options (12 blocks) | 1.5 MB | 120 ms | 1.2 ms | 97× | 122 ms | 2.6 ms | 896 MB → 2.0 MB | 127 → 6 ms |
| flat, 1,000 blocks | 362 KB | 28.5 ms | 1.2 ms | 25× | 36.5 ms | 4.1 ms | 141 MB → 6.8 MB | 39 → 7 ms |
| flat, 5,000 blocks | 1.8 MB | 130 ms | 7.6 ms | 17× | 150 ms | 55 ms | 701 MB → 33 MB | 131 → 16 ms |
| 200 levels deep | 90 KB | 36.2 ms | 0.32 ms | 112× | 40.2 ms | 4.2 ms | 41 MB → 1.3 MB | 48 → 3 ms |

Rendering the **same** content object again (an app that caches its fetch) is cheaper still, because
every block's compiled record is reused.

Server HTML is also 25–60% smaller: one stylesheet instead of a `<style>` per block, the A/B and
personalization scripts only when the content uses them, and no hydration markers inside plain
subtrees.

### Browser: hydration on a `csr = true` SvelteKit page

Chromium via Playwright, median of 5 cold loads. "Hydrated" is `performance.now()` at the page's
`onMount`. TBT counts main-thread blocking over 50 ms.

| Page | CPU | Official hydrated | Ours hydrated | Official TBT | Ours TBT | JS heap |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| landing (248 KB) | 1× | 89 ms | 26 ms | 1 ms | 0 ms | 3.6 → 2.4 MB |
| landing (248 KB) | 4× slower | 280 ms | 89 ms | 149 ms | **0 ms** | |
| page-1m | 1× | 275 ms | 53 ms | 96 ms | 0 ms | 6.5 → 3.3 MB |
| page-1m | 4× slower | 771 ms | 157 ms | 537 ms | **0 ms** | |
| page-2m | 1× | 481 ms | 81 ms | 206 ms | 0 ms | 8.7 → 4.2 MB |
| page-2m | 4× slower | 1,366 ms | 222 ms | 963 ms | **0 ms** | |
| flat, 1,000 blocks | 4× slower | 661 ms | 183 ms | 413 ms | 22 ms | 50 → 5.8 MB |

The SDK's client JavaScript is ~9.5 KB smaller over the wire (75.0 → 65.5 KB for the whole test
page).

### Depth

| Nesting | Official | Ours |
| --- | --- | --- |
| Server render | fails below 400 levels | 20,000+ levels (no recursion in the plain path) |
| Browser hydration | stack overflow at ~55 levels | 700+ levels (beyond that, SvelteKit's own page-data serializer gives out first) |

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

**One stylesheet.** One iterative walk per content finds every reachable block, including blocks
nested in component options, and collects their responsive CSS into a single `<style>`.

**One component per block, with no reactive state unless the block needs it.** A static block reads
its compiled record once. Only blocks with bindings (`Bound`) or a repeat (`Repeat`) get reactive
state. A block picks its shape with a single dynamic `{@render}` rather than an if/else chain, so
nesting doesn't pile up effects.

**Plain subtrees are strings.** A subtree with no behaviour anywhere in it (no custom component, no
bindings, repeat, actions, animations or `{{state}}` text) renders as one `{@html}` string built by a
loop. Svelte never walks into it during hydration, since there is nothing live inside to find. It
costs no component, effect or hydration marker per block. The string follows Svelte's own SSR
attribute rules, and a test checks it **byte for byte** against the live path on every fixture.

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
