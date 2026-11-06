<script lang="ts" module>
	const HTTP_TPL_RE = /{{([^}]+)}}/g;
</script>

<script lang="ts">
	/**
	 * One content render (official ContentComponent + EnableEditor): the wrapper, the page's one
	 * stylesheet, and the blocks from a compiled plan. `<Content>` (the variants wrapper) renders one
	 * of these per content — and one per A/B variant during SSR.
	 *
	 * `live` (inside the Builder editor or a preview, after mount): the content changes under the
	 * mounted tree — the editor's messages, a preview fetch. See internal/live.ts for what an edit costs.
	 */
	import { onMount } from 'svelte';
	import type { BuilderContent, RegisteredComponent } from '../types.js';
	import { create_content, live_plan_of } from '../internal/content.js';
	import { content_styles } from '../internal/content-styles.js';
	import { evaluate } from '../internal/evaluate.js';
	import { provide_scope } from '../internal/context.js';
	import { is_editing, is_previewing } from '../internal/env.js';
	import { coalesce, is_authoring, load_bridge, merge_content, reconcile } from '../internal/live.js';
	import { trigger_animation, type Animation } from '../internal/animator.js';
	import { fetch_one_entry } from '../internal/fetch.js';
	import { get_cookie, interaction_properties, track } from '../internal/track.js';
	import { script_tag, update_variant_visibility_script } from '../internal/ab-tests.js';
	import { blocks_sheet, content_style } from '../internal/tags.js';
	import Blocks from './Blocks.svelte';

	let {
		content,
		model = '',
		data = undefined,
		context = undefined,
		apiKey = undefined,
		apiHost = undefined,
		apiVersion = undefined,
		customComponents = undefined,
		canTrack = undefined,
		locale = undefined,
		enrich = undefined,
		trustedHosts = undefined,
		linkComponent = undefined,
		blocksWrapper = undefined,
		blocksWrapperProps = undefined,
		contentWrapper = 'div',
		contentWrapperProps = undefined,
		nonce = '',
		isNestedRender = false,
		showContent = true,
		isSsrAbTest = false,
		live = false,
		trackImpression = true
	}: {
		content?: BuilderContent | null;
		model?: string;
		data?: Record<string, unknown>;
		context?: Record<string, unknown>;
		apiKey?: string;
		apiHost?: string;
		apiVersion?: string;
		customComponents?: RegisteredComponent[];
		canTrack?: boolean;
		locale?: string;
		enrich?: boolean;
		trustedHosts?: string[];
		linkComponent?: unknown;
		blocksWrapper?: unknown;
		blocksWrapperProps?: Record<string, unknown>;
		contentWrapper?: string;
		contentWrapperProps?: Record<string, unknown>;
		nonce?: string;
		isNestedRender?: boolean;
		showContent?: boolean;
		isSsrAbTest?: boolean;
		live?: boolean;
		/** false: this view replaces one whose impression was already sent (Content.svelte, A/B) */
		trackImpression?: boolean;
	} = $props();

	// The render version: bumped when root state changes (an action, an HTTP request) so the blocks
	// with bindings re-derive. Static blocks never read it.
	let version = $state(0);
	// svelte-ignore state_referenced_locally
	const input = {
		content,
		model,
		data,
		context,
		apiKey,
		apiHost,
		apiVersion,
		customComponents,
		canTrack,
		locale,
		linkComponent,
		blocksWrapper,
		blocksWrapperProps,
		nonce
	};
	// (live: this instance owns its plan — see live_plan_of)
	// svelte-ignore state_referenced_locally
	const live_owner = live ? {} : undefined;
	// svelte-ignore state_referenced_locally
	const { ctx, scope } = create_content(input, () => version, bump, live_owner);
	provide_scope(() => scope);

	function bump() {
		version++;
		for (const notify of ctx.listeners) notify();
		if (live) emit_state();
	}

	// ── live: the content as the editor / a preview has it now ──────────────────────────────────
	// svelte-ignore state_referenced_locally
	let live_content = $state.raw(ctx.content);
	// (the same plan across edits; a new one only for new breakpoints)
	const live_plan = $derived(live_owner ? live_plan_of(live_owner, input, live_content) : null);
	if (live_owner) {
		Object.defineProperty(ctx, 'content', { enumerable: true, get: () => live_content });
		Object.defineProperty(ctx, 'plan', { enumerable: true, get: () => live_plan });
	}

	// A burst of editor messages (one per keystroke, each the whole content) applies once per frame,
	// sharing every untouched object with what is on screen.
	let pending: BuilderContent | undefined;
	const flusher = coalesce(() => {
		const next = pending;
		pending = undefined;
		if (!next) return;
		const shared = reconcile(live_content, next);
		if (shared === live_content) return;
		live_content = shared;
		for (const notify of ctx.listeners) notify();
	});
	function merge_new_content(update: BuilderContent | undefined) {
		if (!update || typeof update !== 'object') return;
		pending = merge_content(pending ?? live_content, update);
		flusher.schedule();
	}

	/** Live: the app handed <Content> a new content object (a refetch) — merged in (official
	 *  EnableEditor `mergeNewContent`), so nothing remounts and the editor's edits stay under it. */
	export function update_content(next: BuilderContent | null | undefined) {
		if (live && next) merge_new_content(next);
	}

	/** official `emitStateUpdate`: the editor's state panel follows root state (editing only). */
	let last_state: string | undefined;
	function emit_state(always = false) {
		if (!is_editing()) return;
		let json: string;
		try {
			json = JSON.stringify(ctx.root);
		} catch {
			return; // (a cycle or a BigInt in state: nothing the editor could read)
		}
		// Unchanged since the last report: say nothing (no echo loop with the editor's own resetState) —
		// unless the editor asked (it has just started listening, and has nothing yet).
		if (json === last_state && !always) return;
		last_state = json;
		window.dispatchEvent(new CustomEvent('builder:component:stateChange', { detail: { state: JSON.parse(json), ref: { name: model } } }));
	}

	const callbacks = {
		contentUpdate: (update: BuilderContent) => merge_new_content(update),
		stateUpdate: (state: Record<string, unknown>) => ctx.root_set_state({ ...ctx.root, ...state }),
		animation: (animation: Record<string, unknown>) => trigger_animation(animation as unknown as Animation),
		configureSdk: ({ breakpoints, contentId }: { breakpoints?: NonNullable<BuilderContent['meta']>['breakpoints']; contentId?: string }) => {
			if (!contentId || contentId !== live_content?.id) return;
			if (breakpoints) merge_new_content({ meta: { breakpoints } });
		}
	};

	/** official EnableEditor preview leg: a preview link of THIS content (or a Builder Studio symbol) renders the draft. */
	function preview() {
		const params = new URL(location.href).searchParams;
		const preview_model = params.get('builder.preview');
		const preview_id = params.get(`builder.overrides.${preview_model}`);
		const preview_key = params.get('apiKey') || params.get('builder.space');
		const studio = preview_model === 'BUILDER_STUDIO';
		if (!studio && !(preview_model === model && preview_key === apiKey && (!content || preview_id === content.id))) return;
		if (!apiKey) return;
		const symbol_id = context?.symbolId as string | undefined;
		fetch_one_entry({ model, apiKey, apiVersion: apiVersion as never, ...(studio && symbol_id ? { query: { id: symbol_id } } : {}) })
			.then((next) => next && merge_new_content(next))
			.catch((err) => console.error('[Builder.io]: Could not fetch the preview content: ', err));
	}

	const styles_html = $derived(
		content_style(nonce, content_styles(ctx.content, isNestedRender)) + (ctx.plan.sheet ? blocks_sheet(nonce, ctx.plan.sheet) : '')
	);

	let clicked = false;

	onMount(() => {
		// Inside Builder this view is about to be replaced by its live twin (Content.svelte), which
		// does all of this — doing it here too would double the requests and the tracking.
		if (!live && is_authoring()) return;
		const teardown = live ? start_live() : undefined;
		const c = ctx.content;
		if (c && trackImpression && (canTrack ?? true) && apiKey) {
			const winning = get_cookie(`builder.tests.${c.id}`, true);
			if (c.testVariationId === winning) {
				void track({
					apiHost,
					type: 'impression',
					canTrack: true,
					contentId: c.id,
					apiKey,
					variationId: winning !== c.id ? winning : undefined
				});
			}
		}
		run_http_requests();
		return teardown;
	});

	function start_live(): () => void {
		const editing = is_editing();
		let stopped = false;
		let stop_listening: (() => void) | undefined;
		if (editing && !isNestedRender) {
			// (the bridge is its own chunk: a visitor's page never downloads it)
			load_bridge().then((bridge) => {
				if (stopped) return;
				const on_message = bridge.editor_listener(model, trustedHosts, callbacks);
				window.addEventListener('message', on_message);
				bridge.setup_browser_for_editing({
					...(locale ? { locale } : {}),
					...(enrich ? { enrich } : {}),
					...(trustedHosts ? { trustedHosts } : {}),
					modelName: model ?? '',
					apiKey: apiKey as string
				});
				bridge.post_component_infos(ctx.registry.by_name.values(), model);
				// (official: the editor's state panel asks, every content answers with its state)
				const on_listener_activated = () => emit_state(true);
				window.addEventListener('builder:component:stateChangeListenerActivated', on_listener_activated);
				stop_listening = () => {
					window.removeEventListener('message', on_message);
					window.removeEventListener('builder:component:stateChangeListenerActivated', on_listener_activated);
				};
			});
		}
		emit_state();
		if (is_previewing() && !editing) preview();
		return () => {
			stopped = true;
			flusher.cancel();
			stop_listening?.();
		};
	}

	function on_click(event: MouseEvent) {
		const c = ctx.content;
		if (c && apiKey) {
			void track({
				apiHost,
				type: 'click',
				canTrack: canTrack ?? true,
				contentId: c.id,
				apiKey,
				variationId: c.testVariationId !== c.id ? c.testVariationId : undefined,
				...interaction_properties(event),
				unique: !clicked
			});
		}
		clicked = true;
	}

	/** official EnableEditor `runHttpRequests` — browser only (the official server run was discarded). */
	function run_http_requests() {
		const requests = (ctx.content?.data?.httpRequests ?? {}) as Record<string, unknown>;
		for (const key in requests) {
			const req = requests[key] as
				| { '@type'?: string; request: { url: string; method?: string; headers?: Record<string, string>; body?: unknown } }
				| string;
			if (!req) continue;
			const request = typeof req === 'object' && req['@type'] === '@builder.io/core:Request' ? req.request : undefined;
			const url = request ? request.url : (req as string);
			const evaluated = url.replace(HTTP_TPL_RE, (_m, code: string) => String(evaluate(code, scope)));
			const method = request?.method ?? 'GET';
			fetch(evaluated, {
				method,
				headers: request?.headers,
				body: method === 'GET' ? undefined : (request?.body as BodyInit | undefined)
			})
				.then((r) => r.json())
				.then((json) => ctx.root_set_state({ ...ctx.root, [key]: json }))
				.catch((err) => console.error('error fetching dynamic data', JSON.stringify(req), err));
		}
	}

	const hidden_props = $derived(showContent ? {} : { hidden: true, 'aria-hidden': true });
	// (live with no content yet: the wrapper is there, hidden, for the editor to fill — official
	// `needsElementRefDivForEditing`)
	const empty_style = $derived(ctx.content ? undefined : 'display: none;');
</script>

{#snippet inner()}
	{#if isSsrAbTest}
		{@html script_tag(
			'builderio-variant-visibility',
			nonce,
			update_variant_visibility_script(String(content?.testVariationId), String(content?.id))
		)}
	{/if}
	{@html styles_html}
	<Blocks blocks={ctx.content?.data?.blocks} linkComponent={ctx.link_component} />
{/snippet}
{#snippet nothing()}{/snippet}
{#snippet wrapped()}
	<svelte:element
		this={contentWrapper}
		builder-content-id={ctx.content?.id}
		builder-model={model}
		classname={'variant-' + (content?.testVariationId || content?.id)}
		style={empty_style}
		onclick={on_click}
		{...hidden_props}
		{...contentWrapperProps}
	>
		{@render inner()}
	</svelte:element>
{/snippet}
<!-- <svelte:element> re-inserts its element on hydration, disconnecting every custom element in it: the default div is a plain element, between empty renders so the server shape stays the same -->
{#snippet div_wrapped()}
	{@render nothing()}<div
		builder-content-id={ctx.content?.id}
		builder-model={model}
		classname={'variant-' + (content?.testVariationId || content?.id)}
		style={empty_style}
		onclick={on_click}
		{...hidden_props}
		{...contentWrapperProps}
	>
		{@render inner()}
	</div>{@render nothing()}
{/snippet}

{#if ctx.content || live}
	{@render ((contentWrapper ?? 'div') === 'div' ? div_wrapped : wrapped)()}
{/if}
