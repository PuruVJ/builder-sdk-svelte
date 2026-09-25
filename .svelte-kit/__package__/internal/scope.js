/**
 * The render scope: what a block's bindings, repeat and actions see. One `ContentCtx` per `<Content>`
 * render (root state, context, globals, the plan), one `Scope` per state layer (the content root, and
 * one per repeat item — the official SDK's `localState`).
 *
 * The official SDK hands every block a Svelte `writable` of the whole context and reads it through a
 * store subscription in four components per block. Here a static block never touches state at all;
 * only a block with bindings / repeat / actions reads its scope, and the `builderContext` store a
 * component asked for is built on demand, once per scope.
 */
import { writable } from 'svelte/store';
import { flatten_state } from './evaluate.js';
export const SCOPE_BRAND = Symbol.for('puruvj.builder.scope');
export class Scope {
    ctx;
    local;
    #state;
    #state_version = -1;
    #store;
    constructor(ctx, local) {
        this.ctx = ctx;
        this.local = local;
    }
    get globals() {
        return this.ctx.globals;
    }
    get context() {
        return this.ctx.context;
    }
    /** Local over root, for reads — built once per scope per state version. */
    state() {
        const v = this.ctx.version();
        if (!this.#state || this.#state_version !== v) {
            this.#state = this.local ? { ...this.ctx.root, ...this.local } : this.ctx.root;
            this.#state_version = v;
        }
        return this.#state;
    }
    writable_state() {
        return flatten_state(this.ctx.root, this.local, (next) => this.ctx.root_set_state(next));
    }
    /** A repeat item's scope (official `getRepeatItemData`). */
    item(name, item, index) {
        return new Scope(this.ctx, {
            ...this.local,
            $index: index,
            $item: item,
            [name]: item,
            [`$${name}Index`]: index
        });
    }
    /** The `builderContext` store (official `BuilderContextInterface`), built on first request. */
    store() {
        if (this.#store)
            return this.#store;
        const ctx = this.ctx;
        const value = {
            content: ctx.content,
            localState: this.local,
            rootSetState: (next) => ctx.root_set_state(next),
            context: ctx.context,
            canTrack: ctx.can_track,
            apiKey: ctx.api_key,
            apiVersion: ctx.api_version,
            inheritedStyles: {},
            BlocksWrapper: ctx.blocks_wrapper,
            BlocksWrapperProps: ctx.blocks_wrapper_props,
            nonce: ctx.nonce,
            model: ctx.model,
            [SCOPE_BRAND]: this
        };
        // Root state is replaced (not mutated) on a write: read it live, never a snapshot.
        Object.defineProperty(value, 'rootState', { enumerable: true, get: () => ctx.root });
        // Editor-only data the official SDK serialises for every <Content>: built only if read.
        Object.defineProperty(value, 'componentInfos', {
            enumerable: true,
            get: () => component_infos(ctx.registry.as_object(ctx.model))
        });
        this.#store = writable(value);
        return this.#store;
    }
}
function component_infos(components) {
    const out = {};
    for (const name in components) {
        const { component: _c, ...info } = components[name];
        out[name] = info;
    }
    return out;
}
/** The scope a `builderContext` store (ours) stands for, or undefined. */
export function scope_of_store(store) {
    if (!store || typeof store !== 'object' || typeof store.subscribe !== 'function')
        return undefined;
    let value;
    store.subscribe((v) => (value = v))();
    return value?.[SCOPE_BRAND];
}
