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
import { writable, type Writable } from 'svelte/store';
import type { BuilderContent, RegisteredComponent } from '../types.js';
import type { Plan } from './compile.js';
import { flatten_state, type EvalScope, type Globals } from './evaluate.js';
import type { Registry } from './registry.js';
import { NOT_IN_EDITOR, serialize_including_functions } from './editor.js';

export const SCOPE_BRAND = Symbol.for('puruvj.builder.scope');

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
	/** `builderContext` stores with a subscriber, told when the content or root state changes. */
	listeners: Set<() => void>;
	root_set_state(next: Record<string, unknown>): void;
}

/** A repeat item's state layer over its parent's (official `getRepeatItemData`). */
function item_layer(parent: Record<string, unknown> | undefined, name: string, item: unknown, index: number): Record<string, unknown> {
	return { ...parent, $index: index, $item: item, [name]: item, [`$${name}Index`]: index };
}

export class Scope implements EvalScope {
	readonly ctx: ContentCtx;
	readonly local: Record<string, unknown> | undefined;
	#state: Record<string, unknown> | undefined;
	#state_version = -1;
	#store: Writable<Record<string, unknown>> | undefined;

	constructor(ctx: ContentCtx, local?: Record<string, unknown>) {
		this.ctx = ctx;
		this.local = local;
	}

	get globals(): Globals {
		return this.ctx.globals;
	}
	get context(): Record<string, unknown> {
		return this.ctx.context;
	}

	/** Local over root, for reads — built once per scope per state version. */
	state(): Record<string, unknown> {
		const v = this.ctx.version();
		if (!this.#state || this.#state_version !== v) {
			this.#state = this.local ? { ...this.ctx.root, ...this.local } : this.ctx.root;
			this.#state_version = v;
		}
		return this.#state;
	}

	writable_state(): Record<string, unknown> {
		return flatten_state(this.ctx.root, this.local, (next) => this.ctx.root_set_state(next));
	}

	/** A repeat item's scope (official `getRepeatItemData`). */
	item(name: string, item: unknown, index: number): Scope {
		return new Scope(this.ctx, item_layer(this.local, name, item, index));
	}

	/**
	 * Points this repeat item's scope (made by `parent.item`) at the item now at its index — the list
	 * changed (reordered, items replaced). In place: the block mounted for this index, and anything
	 * holding this layer (its `builderContext`, a nested <Blocks>), read the new item.
	 */
	retarget(parent: Scope, name: string, item: unknown, index: number): void {
		const next = item_layer(parent.local, name, item, index);
		const local = this.local!;
		for (const key in local) if (!(key in next)) delete local[key];
		Object.assign(local, next);
		this.#state = undefined;
	}

	/** The `builderContext` store (official `BuilderContextInterface`), built on first request. */
	store(): Writable<Record<string, unknown>> {
		if (this.#store) return this.#store;
		const ctx = this.ctx;
		const value: Record<string | symbol, unknown> = {
			// (live in the editor: a getter, in the official key order)
			get content() {
				return ctx.content;
			},
			localState: this.local,
			rootSetState: (next: Record<string, unknown>) => ctx.root_set_state(next),
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
			get: () => component_infos(ctx.registry.by_name.values())
		});
		// The public contract is a Svelte store (custom components read `$builderContext`): it re-emits
		// when the content or root state changes, and costs nothing until something subscribes.
		const store: Writable<Record<string, unknown>> = writable(value as Record<string, unknown>, (set) => {
			const notify = () => set(value as Record<string, unknown>);
			ctx.listeners.add(notify);
			return () => ctx.listeners.delete(notify);
		});
		this.#store = store;
		return store;
	}
}

/** official Content `componentInfos`: every registered component (any model), serialized —
 *  minus ours-only entries the official list does not have (RawText). */
function component_infos(components: Iterable<RegisteredComponent>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const entry of components) {
		if ((entry as { [NOT_IN_EDITOR]?: boolean })[NOT_IN_EDITOR]) continue;
		const { component: _c, ...info } = entry;
		out[entry.name] = serialize_including_functions(info);
	}
	return out;
}

/** The scope a `builderContext` store (ours) stands for, or undefined. */
export function scope_of_store(store: unknown): Scope | undefined {
	if (!store || typeof store !== 'object' || typeof (store as Writable<unknown>).subscribe !== 'function') return undefined;
	let value: Record<string | symbol, unknown> | undefined;
	(store as Writable<Record<string | symbol, unknown>>).subscribe((v) => (value = v))();
	return value?.[SCOPE_BRAND] as Scope | undefined;
}
