<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { BuilderBlock, RegisteredComponents } from '../types.js';
	import { stringify_styles } from '../internal/css.js';
	import Blocks from '../components/Blocks.svelte';

	type Tab = { label?: BuilderBlock[]; content?: BuilderBlock[] };
	let {
		defaultActiveTab = undefined,
		tabs = undefined,
		activeTabStyle = undefined,
		collapsible = undefined,
		tabHeaderLayout = undefined,
		builderBlock,
		builderContext,
		builderComponents,
		builderLinkComponent = undefined
	}: {
		defaultActiveTab?: number;
		tabs?: Tab[];
		activeTabStyle?: Record<string, unknown>;
		collapsible?: boolean;
		tabHeaderLayout?: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
		builderBlock: BuilderBlock;
		builderContext: Writable<Record<string, any>>;
		builderComponents: RegisteredComponents;
		builderLinkComponent?: unknown;
		[k: string]: unknown;
	} = $props();

	/** The active tab index (-1: none, after collapsing): the only client state. */
	// svelte-ignore state_referenced_locally
	let active = $state(defaultActiveTab ? defaultActiveTab - 1 : 0);

	function select(index: number) {
		active = index === active && collapsible ? -1 : index;
	}

	const content = $derived(tabs?.[active]?.content);
</script>

<div>
	<div
		style={`display:flex;flex-direction:row;justify-content:${tabHeaderLayout || 'flex-start'};overflow:auto;`}
		class="builder-tabs-wrap"
	>
		{#each tabs ?? [] as tab, index}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<span
				style={index === active ? stringify_styles(activeTabStyle) : ''}
				class={`builder-tab-wrap ${active === index ? 'builder-tab-active' : ''}`}
				onclick={() => select(index)}
				><Blocks
					parent={builderBlock.id}
					path={`tabs.${index}.label`}
					blocks={tab.label}
					context={builderContext}
					registeredComponents={builderComponents}
					linkComponent={builderLinkComponent}
				/></span
			>
		{/each}
	</div>
	{#if content}
		<!-- A block list renders its blocks once: a different tab is a fresh list. -->
		{#key active}
			<div>
				<Blocks
					parent={builderBlock.id}
					path={`tabs.${active}.content`}
					blocks={content}
					context={builderContext}
					registeredComponents={builderComponents}
					linkComponent={builderLinkComponent}
				/>
			</div>
		{/key}
	{/if}
</div>
