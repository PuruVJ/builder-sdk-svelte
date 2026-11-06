---
'@puruvj/builder-sdk-svelte': minor
---

The official SDK is gone from the runtime, the Builder editor and preview included.

- **In-house editor bridge**: the editor's postMessage protocol (sdkInfo, component registration, content and state updates, breakpoints, animations, `evaluate`, trusted hosts, "+ Add Block" in empty lists) and the preview fetch, without loading `@builder.io/sdk-svelte`. Remove it from your dependencies.
- **Editing does not freeze big pages**: an edit costs what changed. Untouched blocks keep their identity, compiled blocks survive edits, lists are keyed by block id, and a burst of messages applies once per frame; on a page of 300 custom components a keystroke re-renders none of them. A new content object from the app is merged into the page instead of remounting it, and a component that throws while edited empties only its block.
- **Install it under the official name** (`"@builder.io/sdk-svelte": "npm:@puruvj/builder-sdk-svelte"`): the official deep type paths (`@builder.io/sdk-svelte/src/types/…`) and entry points (`/bundle/edge`, `/edge`, …) resolve to this package, and the exported types are the official declarations.
- **Matches the official SDK where it differed**: a `<Blocks>` uses only the `linkComponent` handed to it; A/B variations are applied in `fetchOneEntry` / `fetchEntries` in the browser; `builderContext.componentInfos` lists every component.
- **Fixes**: a reordered repeat shows the right items; one impression per A/B winner; an animation without easing no longer throws; scrollInView listeners are removed; localized styles and properties on nested blocks resolve; a symbol keeps the page's locale in the editor; inline scripts and styles cannot be closed by content (`</script>`, `</style>`); form field names cannot write to `Object.prototype`.
- No `$effect` anywhere in the SDK.
