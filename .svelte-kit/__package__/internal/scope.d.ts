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
import { type Writable } from 'svelte/store';
import type { BuilderContent } from '../types.js';
import type { Plan } from './compile.js';
import { type EvalScope, type Globals } from './evaluate.js';
import type { Registry } from './registry.js';
export declare const SCOPE_BRAND: unique symbol;
export interface ContentCtx {
    plan: Plan;
    registry: Registry;
    model: string;
    content: BuilderContent | undefined;
    /** Root state (official `rootState`): mutated in place by writes, then {@link bump}. */
    root: Record<string, unknown>;
    context: Record<string, unknown>;
    globals: Globals;
    api_key: string | undefined;
    api_version: string | undefined;
    api_host: string | undefined;
    can_track: boolean | undefined;
    nonce: string;
    link_component: unknown;
    blocks_wrapper: unknown;
    blocks_wrapper_props: Record<string, unknown>;
    /** The reactive render version (client): bumped when root state changes. */
    version(): number;
    bump(): void;
    root_set_state(next: Record<string, unknown>): void;
}
export declare class Scope implements EvalScope {
    #private;
    readonly ctx: ContentCtx;
    readonly local: Record<string, unknown> | undefined;
    constructor(ctx: ContentCtx, local?: Record<string, unknown>);
    get globals(): Globals;
    get context(): Record<string, unknown>;
    /** Local over root, for reads — built once per scope per state version. */
    state(): Record<string, unknown>;
    writable_state(): Record<string, unknown>;
    /** A repeat item's scope (official `getRepeatItemData`). */
    item(name: string, item: unknown, index: number): Scope;
    /** The `builderContext` store (official `BuilderContextInterface`), built on first request. */
    store(): Writable<Record<string, unknown>>;
}
/** The scope a `builderContext` store (ours) stands for, or undefined. */
export declare function scope_of_store(store: unknown): Scope | undefined;
