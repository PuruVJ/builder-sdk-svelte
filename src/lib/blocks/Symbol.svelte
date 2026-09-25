<script lang="ts">
	/** A symbol: a nested content (official blocks/symbol) — rendered by our own <Content>. */
	import { onMount } from 'svelte';
	import { get, type Writable } from 'svelte/store';
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
	// svelte-ignore state_referenced_locally
	let content_to_use = $state(symbol?.content);
	// svelte-ignore state_referenced_locally
	let entry = symbol?.entry;

	function set_content() {
		if (content_to_use && entry === symbol?.entry) return;
		if (!symbol?.model || !ctx.apiKey) return;
		fetch_one_entry({
			model: symbol.model,
			apiKey: symbol.global && symbol.ownerId ? symbol.ownerId : ctx.apiKey,
			apiVersion: ctx.apiVersion,
			...(symbol.entry ? { query: { id: symbol.entry } } : {})
		})
			.then((c) => {
				if (c) {
					content_to_use = c;
					entry = symbol?.entry;
				}
			})
			.catch((err) => console.error('[Builder.io]: Could not fetch symbol content: ', err));
	}
	// The official SDK also fires this fetch during SSR and throws the result away; only the browser does.
	onMount(set_content);

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
	<!-- <Content> reads its props once; a symbol whose content arrives later (browser fetch) remounts it -->
	{#key content_to_use}
	<Content
		nonce={ctx.nonce}
		isNestedRender={true}
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
