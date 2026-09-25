<script module lang="ts">
	// official accordionStyles() / accordionTitleStyles(), pre-stringified (they never depend on state).
	const ROOT_STYLE = 'display:flex;align-items:stretch;flex-direction:column;';
	const ROOT_STYLE_GRID = 'display:flex;align-items:flex-start;flex-direction:row;flex-wrap:wrap;';
	const TITLE_STYLE = 'display:flex;flex-direction:column;align-items:stretch;cursor:pointer;';
</script>

<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { BuilderBlock, RegisteredComponents } from '../types.js';
	import Blocks from '../components/Blocks.svelte';

	type Item = { title?: BuilderBlock[]; detail?: BuilderBlock[] };
	let {
		grid = undefined,
		oneAtATime = undefined,
		items = undefined,
		gridRowWidth = undefined,
		builderBlock,
		builderContext,
		builderComponents,
		builderLinkComponent = undefined
	}: {
		grid?: boolean;
		oneAtATime?: boolean;
		items?: Item[];
		gridRowWidth?: string;
		useChildrenForItems?: boolean;
		builderBlock: BuilderBlock;
		builderContext: Writable<Record<string, any>>;
		builderComponents: RegisteredComponents;
		builderLinkComponent?: unknown;
		[k: string]: unknown;
	} = $props();

	/** Indices of the open items: the only client state. */
	let open: number[] = $state.raw([]);
	let root: HTMLElement | undefined;

	function toggle(index: number) {
		const one = Boolean(grid || oneAtATime);
		if (open.includes(index)) open = one ? [] : open.filter((item) => item !== index);
		else open = one ? [index] : open.concat(index);
	}

	/**
	 * official `openGridItemOrder`: in a grid, the detail goes after the last title on the open
	 * title's row (measured). `null` unless a grid item is open.
	 */
	const order: number | null = $derived.by(() => {
		if (!grid || !open.length) return null;
		const open_index = open[0];
		let item_order = open_index;
		let subject: Element | null | undefined = root?.querySelector(`.builder-accordion-title[data-index="${open_index}"]`);
		if (subject) {
			let prev_rect = subject.getBoundingClientRect();
			while ((subject = subject.nextElementSibling)) {
				if (subject.classList.contains('builder-accordion-detail')) continue;
				const rect = subject.getBoundingClientRect();
				if (rect.left > prev_rect.left) {
					const index = parseInt(subject.getAttribute('data-index') || '', 10);
					if (!isNaN(index)) {
						prev_rect = rect;
						item_order = index;
					}
				} else break;
			}
		}
		return item_order + 1;
	});

	function title_style(index: number): string {
		if (!grid) return TITLE_STYLE;
		return `${TITLE_STYLE}width:${gridRowWidth};order:${order !== null ? index : index + 1};`;
	}

	function detail_style(): string {
		return (order !== null ? `order:${order};` : '') + (grid ? 'width:100%;' : '');
	}
</script>

<div style={grid ? ROOT_STYLE_GRID : ROOT_STYLE} class="builder-accordion" bind:this={root}>
	{#each items ?? [] as item, index}
		{@const is_open = open.includes(index)}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			style={title_style(index)}
			class={`builder-accordion-title builder-accordion-title-${is_open ? 'open' : 'closed'}`}
			data-index={index}
			onclick={() => toggle(index)}
		>
			<Blocks
				blocks={item.title}
				path={`items.${index}.title`}
				parent={builderBlock.id}
				context={builderContext}
				registeredComponents={builderComponents}
				linkComponent={builderLinkComponent}
			/>
		</div>

		{#if is_open}
			<div style={detail_style()} class="builder-accordion-detail builder-accordion-detail-open">
				<Blocks
					blocks={item.detail}
					path={`items.${index}.detail`}
					parent={builderBlock.id}
					context={builderContext}
					registeredComponents={builderComponents}
					linkComponent={builderLinkComponent}
				/>
			</div>
		{/if}
	{/each}
</div>
