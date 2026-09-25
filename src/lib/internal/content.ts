/**
 * One `<Content>` render: its plan, its root state, its root scope. The same composition as the
 * official SDK (`getContentInitialValue` / `getRootStateInitialValue`), built once per render.
 */
import type { BuilderBlock, BuilderContent, RegisteredComponent } from '../types.js';
import { plan_for, type Plan } from './compile.js';
import { evaluate, type Globals } from './evaluate.js';
import { is_browser, is_editing } from './env.js';
import { registry_for } from './registry.js';
import { Scope, type ContentCtx } from './scope.js';
import { get_user_attributes, track } from './track.js';

export interface ContentInput {
	content: BuilderContent | null | undefined;
	model: string;
	data?: Record<string, unknown>;
	context?: Record<string, unknown>;
	apiKey?: string;
	apiHost?: string;
	apiVersion?: string;
	customComponents?: RegisteredComponent[];
	canTrack?: boolean;
	locale?: string;
	linkComponent?: unknown;
	blocksWrapper?: unknown;
	blocksWrapperProps?: Record<string, unknown>;
	nonce?: string;
}

/** official `getContentInitialValue`: the content with `data` merged into `content.data`. */
export function merged_content(content: BuilderContent | null | undefined, data: Record<string, unknown> | undefined) {
	if (!content) return undefined;
	if (!data) return content;
	return { ...content, data: { ...content.data, ...data }, meta: content.meta } as BuilderContent;
}

/** official `getRootStateInitialValue` */
export function initial_root_state(
	content: BuilderContent | null | undefined,
	data: Record<string, unknown> | undefined,
	locale: string | undefined
): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};
	for (const input of content?.data?.inputs ?? []) {
		if (input.name && input.defaultValue !== undefined) defaults[input.name] = input.defaultValue;
	}
	return { ...defaults, ...(content?.data?.state ?? {}), ...data, ...(locale ? { locale } : {}) };
}

/**
 * The plan a content renders from. Keyed by the content OBJECT the app passed: the same object
 * rendered again (an app that caches its fetch) reuses every compiled block; a fresh object compiles
 * once. (When `data` carries its own `blocks`, those are what render: key by that array instead.)
 */
export function plan_of(input: ContentInput): Plan {
	// (what merged_content would give, read without building it: `data` wins, `meta` is the content's)
	const own_blocks = input.data?.blocks as BuilderBlock[] | undefined;
	const blocks = own_blocks ?? input.content?.data?.blocks;
	const key = own_blocks ? (own_blocks as object) : (input.content ?? EMPTY);
	return plan_for(
		key,
		{
			registry: registry_for(input.customComponents),
			model: input.model,
			locale: input.locale,
			breakpoints: input.content?.meta?.breakpoints
		},
		blocks
	);
}

export function create_content(
	input: ContentInput,
	version: () => number,
	bump: () => void
): { ctx: ContentCtx; scope: Scope } {
	const content = merged_content(input.content, input.data);
	const plan = plan_of(input);
	const registry = plan.registry;
	let root = initial_root_state(input.content, input.data, input.locale);
	let initializing = true;
	// The `builder` globals content code sees — built only when some code runs (most content has none).
	let globals: Globals | undefined;
	const make_globals = (): Globals => ({
		isEditing: is_editing(),
		isBrowser: is_browser(),
		isServer: !is_browser(),
		getUserAttributes: () => get_user_attributes(),
		trackConversion: (amount, customProperties) => {
			const api_key = input.apiKey ?? null;
			const can_track = input.canTrack ?? true;
			if (!api_key || can_track === false) return;
			void track({
				type: 'conversion',
				apiKey: api_key,
				canTrack: can_track,
				contentId: content?.id,
				variationId: content?.testVariationId !== content?.id ? content?.testVariationId : undefined,
				metadata: { ...(customProperties || {}), ...(amount !== undefined ? { amount } : {}) },
				apiHost: input.apiHost
			});
		}
	});
	const ctx: ContentCtx = {
		plan,
		registry,
		model: input.model,
		content,
		get globals() {
			return (globals ??= make_globals());
		},
		get root() {
			return root;
		},
		set root(v) {
			root = v;
		},
		context: input.context ?? {},
		api_key: input.apiKey,
		api_version: input.apiVersion,
		api_host: input.apiHost,
		can_track: input.canTrack,
		nonce: input.nonce ?? '',
		link_component: input.linkComponent,
		blocks_wrapper: input.blocksWrapper ?? 'div',
		blocks_wrapper_props: input.blocksWrapperProps ?? {},
		version,
		bump,
		root_set_state(next) {
			root = next;
			// A write while this content is being set up (jsCode) is read by the first render; only a
			// later write (an action, a fetch) needs a re-render.
			if (!initializing) bump();
		}
	};
	const scope = new Scope(ctx);

	// official Content: run the content's dynamic JS (on both legs, like the official SDK).
	// Writes it makes land in root state; the render that follows reads them (no re-render needed).
	const js = content?.data?.jsCode;
	if (js) {
		const writable = () => scope.writable_state();
		evaluate(js, { state: writable, writable_state: writable, globals: ctx.globals, context: ctx.context }, false);
	}
	initializing = false;
	return { ctx, scope };
}

const EMPTY = {};
