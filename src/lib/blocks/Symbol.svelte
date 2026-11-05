<script lang="ts">
	/** A symbol: a nested content (official blocks/symbol) — rendered by our own <Content>. */
	import { untrack } from 'svelte';
	import { get, type Writable } from 'svelte/store';
	import { reconcile } from '../internal/live.js';
	import { scope_of_store } from '../internal/scope.js';
	import type { BuilderBlock, BuilderContent, RegisteredComponents } from '../types.js';
	import { all_attrs } from './helpers.js';
	import { fetch_one_entry } from '../internal/fetch.js';
	import Content from '../components/Content.svelte';

	type SymbolInfo = {
		model?: string;
		entry?: string;
		data?: Record<string, unknown>;
		content?: BuilderContent;
		inline?: boolean;
		dynamic?: boolean;
		ownerId?: string;
		global?: boolean;
	};
	let {
		symbol = undefined,
		builderComponents,
		attributes = {},
		dynamic = undefined,
		builderContext,
		builderBlock,
		builderLinkComponent = undefined
	}: {
		symbol?: SymbolInfo;
		builderComponents: any;
		attributes?: Record<string, unknown>;
		dynamic?: boolean;
		builderContext: Writable<Record<string, any>>;
		builderBlock: BuilderBlock;
		builderLinkComponent?: unknown;
		[k: string]: unknown;
	} = $props();

	// svelte-ignore state_referenced_locally
	const ctx = get(builderContext);
	// Inside a live tree (the editor) this is a client render: the symbol's content starts live too.
	// svelte-ignore state_referenced_locally
	const live_parent = scope_of_store(builderContext)?.ctx.plan.live === true;
	// The content: the inline one, until a fetched one (for the entry asked) arrives.
	let fetched: BuilderContent | undefined = $state.raw();
	// svelte-ignore state_referenced_locally
	let entry = symbol?.entry;
	const content_to_use = $derived(fetched ?? symbol?.content);

	let request = 0;
	function set_content() {
		if (content_to_use && entry === symbol?.entry) return;
		if (!symbol?.model || !ctx.apiKey) return;
		const asked = symbol.entry;
		const id = ++request;
		fetch_one_entry({
			model: symbol.model,
			apiKey: symbol.global && symbol.ownerId ? symbol.ownerId : ctx.apiKey,
			apiVersion: ctx.apiVersion,
			...(asked ? { query: { id: asked } } : {})
		})
			.then((c) => {
				// (an older request answering late never replaces a newer one)
				if (c && id === request) {
					fetched = c;
					entry = asked;
				}
			})
			.catch((err) => console.error('[Builder.io]: Could not fetch symbol content: ', err));
	}
	// The official SDK also fires this fetch during SSR and throws the result away; only the browser
	// does. Then again whenever the symbol's entry changes (the editor pointing it at another symbol).
	$effect(() => {
		symbol?.entry;
		symbol?.model;
		untrack(set_content);
	});

	// <Content> reads its props once: a symbol remounts it when what it renders changes — compared by
	// value (a bound or edited symbol hands over a new but often equal object), never on every render.
	let shared: unknown;
	const view_key = $derived.by(() => {
		const next = reconcile(shared, [content_to_use, symbol?.data, ctx.localState]);
		return (shared = next);
	});

	const class_name = $derived(
		[
			attributes.class,
			'builder-symbol',
			symbol?.inline ? 'builder-inline-symbol' : undefined,
			symbol?.dynamic || dynamic ? 'builder-dynamic-symbol' : undefined
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<div {...all_attrs(attributes)} class={class_name}>
	{#key view_key}
	<Content
		nonce={ctx.nonce}
		isNestedRender={true}
		startLive={live_parent}
		apiVersion={ctx.apiVersion}
		apiKey={symbol?.global && symbol?.ownerId ? symbol.ownerId : ctx.apiKey}
		context={{ ...ctx.context, symbolId: builderBlock?.id }}
		customComponents={builderComponents}
		data={{ ...symbol?.data, ...ctx.localState, ...content_to_use?.data?.state }}
		canTrack={ctx.canTrack}
		model={symbol?.model ?? ''}
		content={content_to_use}
		linkComponent={builderLinkComponent}
		blocksWrapper="div"
		contentWrapper="div"
	/>
	{/key}
</div>
