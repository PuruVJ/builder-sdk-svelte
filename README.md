# @puruvj/builder-sdk-svelte

A rewrite of [`@builder.io/sdk-svelte@5.2.0`](https://www.npmjs.com/package/@builder.io/sdk-svelte)
for Svelte 5, built for pages where Builder content is **big**: hundreds of kilobytes to megabytes
of JSON per request, hundreds of custom components, rendered on every request and edited live in
the Builder editor.

It is a drop-in: the official SDK's public API, markup, types and editor protocol. It does **not use
the official SDK at all**, at runtime, in the visual editor or in a preview. It passes the official
SDK's own end-to-end suite with **20 more tests passing** than official 5.2.0 does.

- **Editing in the Builder editor does not freeze big pages**: a keystroke on a page of 300 custom
  components re-renders none of them and lands in ~40 ms on a CPU slowed 6×. The official SDK
  re-renders all 300 on every keystroke: ~400 ms with 5.2.0 and ~530 ms with the newest official
  release (5.4.2), and a burst of 20 keystrokes takes 7–10 seconds.
- **Server rendering is 6–8× faster than the newest official SDK (5.4.2)**, with ~8× less memory per
  render, and 120–290× faster than 5.2.0, on production pages.
- **Hydration is 1.3–4× faster than 5.4.2**, with no main-thread blocking even on a CPU slowed 4×.
- **Svelte 5 throughout**: runes, no `$effect` anywhere, and the whole test suite also runs in Svelte's
  async mode (`experimental.async`).

Versions say what it is: **`5.2.0-fork.N`** is a fork of the official 5.2.0, our Nth release.

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
renders every request. (That is 5.2.0. The newest official release, 5.4.2, cut most of the
per-block re-processing: it is 15–35× faster on the server than 5.2.0, and this package is still
6–8× faster than it, and 20–150× on flat or deep pages. See [Numbers](#numbers).)

**In the editor it gets worse, in every official release.** The editor re-sends the whole content on
every keystroke, and every block of the official SDK subscribes to one store holding it: each
keystroke re-processes every block and hands every custom component new props. On a page with
hundreds of components that is half a second of main-thread work per keystroke on a slow laptop
(more with 5.4.2 than with 5.2.0), seconds for a burst of typing, and the editor freezes.

**And it is Svelte 4-era code.** The official Svelte SDK is written as legacy-mode components
(`export let`, `$:`, `<slot>`, stores) and loads that tree into the page whenever it is edited or
previewed. Apps on Svelte 5's async mode have run into trouble with it. This package is runes
throughout, never loads the official SDK, and is tested in async mode as well as the default.

## Numbers

Measured on an Apple M4 Max, Node 26, Svelte 5.57, against **two official releases**: 5.2.0 (the one
this is a fork of) and 5.4.2 (the newest). Every measurement runs in its own process. "Fresh" means
a new content object per render (the app fetched and parsed JSON), which is the real per-request
case. Reproduce everything with the commands in [Benchmarks](#benchmarks). The pages are synthetic
but production-shaped: a handful of custom components carrying large options, editor snapshots,
tracking pixels and a personalization container (`scripts/gen-fixtures.mjs`).

### Editor: one edit on a page of 300 custom components

Inside an editor-shaped frame (`tests/editor-perf.test.ts`): 100 sections, each a custom component,
two Text blocks and a Columns with a custom component in each column. Each cell is the time until the
edit is on screen, and how many of the 300 custom components got new props.

| Edit | 5.2.0 | 5.4.2 | Ours | 5.2.0, CPU 6× slower | 5.4.2, CPU 6× slower | Ours, CPU 6× slower |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Type in one Text | 69 ms · 300 | 90 ms · 300 | **21 ms · 0** | 395 ms · 300 | 534 ms · 300 | **40 ms · 0** |
| Edit one component's option | 65 ms · 300 | 90 ms · 300 | **26 ms · 1** | 388 ms · 300 | 512 ms · 300 | **30 ms · 1** |
| 20 keystrokes, as fast as the editor sends them | 1,112 ms · 6,060 | 1,537 ms · 6,060 | **34 ms · 0** | 7,020 ms · 6,060 | 9,561 ms · 6,060 | **149 ms · 0** |
| Insert a section (3 new components) | 60 ms · 303 | 81 ms · 303 | **20 ms · 3** | 371 ms · 303 | 505 ms · 303 | **39 ms · 3** |
| Editor state reset | 67 ms · 303 | 82 ms · 303 | **0 ms · 0** | 349 ms · 303 | 479 ms · 303 | **2 ms · 0** |

The newest official release is faster on the server, but slower than 5.2.0 in the editor.

### Server: one whole page

Four `<Content>` roots per request (body, footer, accessibility toggle, support module), a
230-entry component list, Svelte 4-style app components:

| Page (JSON in) | 5.2.0 p50 | 5.4.2 p50 | Ours p50 | vs 5.4.2 | vs 5.2.0 | Allocated / request (5.2.0 / 5.4.2 / ours) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| landing-small (129 KB) | 14.8 ms | 0.47 ms | 0.082 ms | **5.7×** | 180× | 90 / 1.4 / 0.23 MB |
| landing (280 KB) | 26.9 ms | 0.85 ms | 0.127 ms | **6.7×** | 212× | 182 / 2.4 / 0.31 MB |
| landing-large (519 KB) | 45.4 ms | 1.50 ms | 0.193 ms | **7.8×** | 235× | 321 / 4.0 / 0.47 MB |

On pages captured from a production site (kept local, see
[Testing with your own pages](#testing-with-your-own-pages)) the same whole-page render is **6–8×
faster than 5.4.2** (0.5–1.4 ms → 0.08–0.17 ms, 1.3–3.1 MB → 0.21–0.41 MB allocated) and 122–286×
faster than 5.2.0 (12–49 ms).

### Server: one `<Content>`, every scale

| Fixture | JSON | 5.2.0 p50 | 5.4.2 p50 | Ours p50 | vs 5.4.2 | vs 5.2.0 | 5.4.2 p99 | Ours p99 | Allocated / render (5.2.0 / 5.4.2 / ours) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| page-50k | 62 KB | 5.2 ms | 0.183 ms | 0.032 ms | 6× | 162× | 0.84 ms | 0.065 ms | 35 / 0.49 / 0.09 MB |
| page-250k | 268 KB | 22 ms | 0.643 ms | 0.087 ms | 7× | 259× | 2.0 ms | 0.148 ms | 158 / 1.7 / 0.19 MB |
| page-500k | 526 KB | 44 ms | 1.1 ms | 0.158 ms | 7× | 279× | 2.2 ms | 1.6 ms | 310 / 2.8 / 0.29 MB |
| page-1m | 983 KB | 81 ms | 2.4 ms | 0.310 ms | 8× | 262× | 4.0 ms | 1.9 ms | 582 / 6.0 / 0.61 MB |
| page-2m | 1.9 MB | 163 ms | 4.3 ms | 0.574 ms | 8× | 284× | 6.3 ms | 2.5 ms | 1,100 / 9.6 / 0.97 MB |
| page-4m | 3.9 MB | 300 ms | 9.8 ms | 1.2 ms | 8× | 255× | 15 ms | 3.5 ms | 2,300 / 21 / 2.0 MB |
| wide options (12 blocks) | 1.5 MB | 120 ms | 1.8 ms | 0.214 ms | 8× | 559× | 3.4 ms | 0.51 ms | 896 / 3.3 / 0.16 MB |
| flat, 1,000 blocks | 362 KB | 26 ms | 21 ms | 0.473 ms | **45×** | 56× | 34 ms | 4.0 ms | 141 / 80 / 3.0 MB |
| flat, 5,000 blocks | 1.8 MB | 132 ms | 105 ms | 5.4 ms | **19×** | 24× | 125 ms | 12 ms | 701 / 393 / 15 MB |
| 200 levels deep | 90 KB | 32 ms | 30 ms | 0.202 ms | **151×** | 161× | 36 ms | 3.9 ms | 41 / 30 / 0.93 MB |

5.4.2 fixed most of 5.2.0's per-block re-processing, but not what grows with the number of blocks or
the depth: on flat and deep pages it is still within 20% of 5.2.0.

Rendering the **same** content object again (an app that caches its fetch) is cheaper still, because
every block's compiled record is reused. For most pages the SDK is now cheaper than the `JSON.parse`
of the content the app fetched (a 330 KB page parses in ~0.5 ms and renders in ~0.14 ms).

Server HTML is also smaller: 20–30% smaller than 5.4.2 and 60–80% smaller than 5.2.0 on the
production pages. One stylesheet instead of a `<style>` per block, the A/B and personalization
scripts only when the content uses them, and no hydration markers inside plain subtrees.

### Browser: hydration on a `csr = true` SvelteKit page

Chromium via Playwright, median of 5 cold loads. "Hydrated" is `performance.now()` at the page's
`onMount`. TBT counts main-thread blocking over 50 ms.

| Page | CPU | Hydrated (5.2.0 / 5.4.2 / ours) | TBT (5.2.0 / 5.4.2 / ours) | JS heap (5.2.0 / 5.4.2 / ours) |
| --- | --- | ---: | ---: | ---: |
| landing (248 KB) | 1× | 90 / 35 / **26 ms** | 0 / 0 / **0 ms** | 3.7 / 3.6 / 2.5 MB |
| landing (248 KB) | 4× slower | 267 / 118 / **90 ms** | 142 / 5 / **0 ms** | |
| page-1m | 1× | 260 / 73 / **53 ms** | 91 / 0 / **0 ms** | 6.5 / 6.5 / 3.5 MB |
| page-1m | 4× slower | 711 / 203 / **146 ms** | 481 / 41 / **0 ms** | |
| page-2m | 1× | 467 / 108 / **82 ms** | 191 / 0 / **0 ms** | 8.8 / 8.8 / 4.5 MB |
| page-2m | 4× slower | 1,475 / 341 / **240 ms** | 1,055 / 88 / **0 ms** | |
| flat, 1,000 blocks | 1× | 202 / 217 / **52 ms** | 71 / 94 / **0 ms** | 50 / 51 / 3.8 MB |
| flat, 1,000 blocks | 4× slower | 749 / 749 / **167 ms** | 458 / 489 / **0 ms** | |

The page's JavaScript over the wire is about the same with all three (~80 KB for the whole test
app); the editor bridge is a separate 2.4 KB chunk that visitors never load.

### Depth

| Nesting | Official 5.2.0 | Ours |
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

Or leave every import alone and install it **under the official name** (recommended). Your code,
including type imports from the official deep paths (`@builder.io/sdk-svelte/src/types/builder-block`
and every other official type module) and the official entry points (`/bundle/browser`,
`/bundle/node`, `/bundle/edge`, `/edge`, …), keeps working unchanged:

```jsonc
// package.json
"dependencies": {
  "@builder.io/sdk-svelte": "npm:@puruvj/builder-sdk-svelte@5.2.0-fork.11"
}
```

The exported types are the official SDK's own declarations (vendored at the official paths), so
`svelte-check` sees exactly what it saw before (`tests/types-compat.test.ts` checks every deep path,
in both `bundler` and `node10` resolution).

Or alias the package in `vite.config.js` (runtime imports only: deep type imports then need the
official package installed):

```js
export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: [{ find: /^@builder\.io\/sdk-svelte$/, replacement: '@puruvj/builder-sdk-svelte' }]
  }
});
```

You can uninstall `@builder.io/sdk-svelte`: nothing here loads it, in the editor or anywhere else.

### What's exported

`Content`, `Blocks`, the built-in blocks (`Button`, `Columns`, `Fragment`, `Image`, `Section`,
`Symbol`, `Text`), `isEditing`, `isPreviewing`, `fetchOneEntry`, `fetchEntries`,
`getBuilderSearchParams`, `setClientUserAttributes`, `track`, `_processContentResult`, the
editor functions (`register`, `registerAction`, `setEditorSettings`, `subscribeToEditor`,
`createRegisterComponentMessage`) and the official types. It also includes built-in Accordion, Tabs, Video, Form (+ inputs), Custom Code, Embed,
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

**Live content costs what changed.** In the editor and in a preview, the view re-renders live once
the page is up (never while hydrating: the server rendered the static shape). Every editor message is
the whole content again, all new objects, so:

- **Structural sharing.** The incoming content is reconciled with what is on screen: every part
  deep-equal to the current one *is* the current object (blocks matched by id, so inserting or moving a
  block keeps its siblings). An untouched block is the same object as before.
- **A plan that outlives edits.** The live plan is kept for the life of the view, so an untouched block
  is a compile-cache hit and Svelte sees no change below it. Only the edited block and its ancestors
  re-derive.
- **Keyed by block id.** Lists are keyed by id (made unique within a list), so an edited block, and
  each of its ancestors, updates in place: no remount, no lost component state.
- **One structure per block.** A block applies its bindings in place, so gaining or losing a binding
  never remounts what is inside it.
- **Once per frame.** A burst of messages (one per keystroke) is merged and applied once per animation
  frame.
- **No effects to loop.** There is no `$effect` in the SDK; what must run again runs from a keyed,
  imperative call (`Run.svelte`) that reads no state.
- **A failing block stays a block.** In the editor, a custom component that throws empties only its
  own block (logged), and is retried on its next edit.
- **Visitors pay nothing.** The editor bridge is a separate 2.4 KB chunk, loaded only inside Builder.

## Compatibility

- **Official e2e suite** (`e2e/suite`, copied from BuilderIO/builder `packages/sdks-tests`, run
  against the official SvelteKit e2e app built once per SDK): official 5.2.0 **180 passed**, ours
  **200 passed**, the same in Svelte's async mode. Every editing test passes. The extra 20 are A/B
  variants rendered during SSR (whole pages and nested symbols), which official 5.2.0 fails. One
  test passes only with the official SDK: `NotLazyComponent loads immediately`, which inspects how
  the bundle is split into files.
- **Differential tests against the official SDK**, everywhere one exists:
  - every module's functions against the official functions (`tests/unit`, 100% line coverage of the
    SDK's modules), from fetch URLs and tracking payloads to CSS, scripts and code evaluation;
  - every built-in component and every prop, server-rendered through both SDKs, and through ours
    live (`tests/unit/components`);
  - random content through both SDKs (`tests/fuzz.test.ts`, thousands of seeds, shrunk on failure);
  - client behaviour in a real browser through both SDKs and ours in async mode (`tests/client-*`):
    interactions, state, animations, tracking, A/B tests, personalization, preview links, the editor
    bridge, hydration of every official spec page, client navigation;
  - the editor: random edit sequences against a fresh render of the result (`tests/editor-fuzz`),
    the messages the editor receives (`tests/editor-parity`), and what one edit costs
    (`tests/editor-perf`).
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
needs them. Also (found by the fuzz test, `tests/fuzz.test.ts`, which renders thousands of random
pages through both SDKs):

- Where the official SDK throws, ours does not: Tabs with no tab at the active index, editor messages
  with no data, an origin that does not parse, `builder.evaluate` code that does not compile (it gets
  a `builder.evaluateError` reply), `subscribeToEditor` on the server.
- The official SDK's own bugs are not copied (each is recorded by a test): among them Accordion and
  Tabs highlighting the wrong item, Form's sending / success / error messages never showing, a blank
  page after hydration when a non-default A/B variation wins, form field names like `__proto__.x`
  writing to `Object.prototype`, and scroll listeners outliving the page.
- An Embed runs `<script>` tags that have no `type`; the official Embed skips them.
- `Builder:RawText` is registered as a built-in. The official Svelte SDK ships the block but does not
  register it, so there it renders as an unknown component.
- A `</style` inside a style value (or `cssCode`) is written `<\/style`, the same CSS, so it cannot
  close the style tag. The official SDK lets it close the tag, and the rest of the value becomes
  markup on the page.
- The personalization and A/B inline scripts carry content as JSON. A `</script` or `<!--` in it (a
  Custom Code block with a script, inside a personalization variant) is written `<\/script` /
  `<\!--`, the same JS string, and ids are JSON-quoted (the same bytes for any plain id). The
  official SDK lets the content end the script, and the rest of the JSON shows on the page as text.
- Whitespace-only text between blocks is not byte-identical. It only shows where the browser repairs
  invalid HTML, such as a block with a link inside another linked block: the parser re-opens the outer
  link around each text node, so the repaired trees differ. The markup as written is the same.
- During SSR of an A/B test, a block of one variation that never renders (a child of a Text, or of a
  hidden block) still has its rules in that variation's stylesheet. If a block of another variation
  shares its id with different styles, those rules reach it. Within one content (and its inline
  symbols) duplicate ids are handled.

### Editor and preview

The official SDK is not used here, not even inside the editor. `<Content>` speaks the editor's
protocol itself, message for message the same as the official SDK (checked by
`tests/editor-parity.test.ts`):

- `builder.sdkInfo` / `builder.updateContent` on start, a `builder.registerComponent` for every
  component (the official built-ins with the official inputs, in the official order), and `register`,
  `registerAction`, `setEditorSettings`, `subscribeToEditor`;
- content updates, state resets, breakpoints (`configureSdk`), triggered animations, `evaluate`
  (results, errors, promises), trusted hosts (default or yours);
- "+ Add Block" in an empty list (`builder.clickEmptyBlocks` / `builder.hoverEmptyBlocks`), and an
  empty `<Content>` the editor fills;
- `builder:component:stateChange` for the editor's state panel;
- in a preview link, the draft fetch (and Builder Studio symbols).

A new content object from the app while editing (a refetch, a swap) is merged into the page, as the
official SDK does, instead of remounting it: the editor's edits keep applying on top. See
[How it works](#how-it-works) for what an edit costs.

Normal visitors run none of this, and never download it.

## Development

```sh
pnpm install
pnpm test               # everything: the library, fixtures, the bench bundle, the e2e app per SDK, every test
```

Builds and test runs go through [Turborepo](https://turborepo.com) (`turbo.json`): a step whose
inputs did not change is replayed from the cache, not run. `pnpm turbo run build` builds the library,
`pnpm e2e:build` the SvelteKit e2e app once per SDK (the browser tests use it). Captured pages in
`fixtures/real` are part of the test steps' inputs, so adding one re-runs them.

The cache is shared through Turborepo's remote cache (Vercel) once you link it: `pnpm turbo login`
then `pnpm turbo link`. CI uses the same cache (the `TURBO_TOKEN` secret and `TURBO_TEAM` variable),
plus GitHub's cache of `.turbo/cache`, so a commit CI already built is not built again, locally or
in CI.

| Command | What runs |
| --- | --- |
| `pnpm test:unit` | every module and component from source, in-process (fast) |
| `pnpm test:coverage` | the same, with line coverage of `src/lib` |
| `pnpm test:editor-fuzz` | random editor edit sequences, both SDKs (`EDITOR_FUZZ_SEEDS`, `EDITOR_FUZZ_SEED`) |
| `pnpm test:async-ssr` | SSR parity with both SDKs compiled in Svelte's async mode |
| `FUZZ_SEEDS=2000 pnpm vitest run tests/fuzz.test.ts` | the render fuzz, more seeds (`FUZZ_SEED` replays one) |

Browser tests skip themselves when the e2e app is not built. CI (`.github/workflows/test.yml`)
builds everything and runs the whole suite on every pull request.

### Releasing

Versions are `5.2.0-fork.N`: the official release this is a fork of, and our release number. A pull
request that changes the package adds a changeset (`pnpm changeset`, patch or minor); on merge, a
"Version Packages" pull request is opened, and merging that publishes to npm (trusted publishing,
with provenance) and tags the release. Rebasing on a newer official release:
[.changeset/README.md](./.changeset/README.md).

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

pnpm e2e:build:async && pnpm e2e:ours:async   # the same app compiled in Svelte's async mode
```

### Testing with your own pages

`scripts/grab-real.mjs` captures pages of a live SvelteKit + Builder site with a headless browser.
`scripts/extract-kit-data.mjs` and `scripts/extract-contents.mjs` pull every Builder content out of
the captured SvelteKit data into `fixtures/real/`. That folder is **gitignored**: every test and
bench picks it up automatically when it exists, and your content stays on your machine.

## License

MIT © Puru Vijayvargia. Includes MIT-licensed code from [Builder.io's SDKs](https://github.com/BuilderIO/builder).
See [LICENSE](./LICENSE).
