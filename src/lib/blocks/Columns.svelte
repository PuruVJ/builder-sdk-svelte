<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { get } from 'svelte/store';
	import type { BuilderBlock, RegisteredComponents } from '../types.js';
	import { sizes_for } from '../internal/breakpoints.js';
	import { stringify_styles } from '../internal/css.js';
	import Blocks from '../components/Blocks.svelte';

	type Column = { blocks?: BuilderBlock[]; width?: number; link?: string };
	let {
		space = undefined,
		columns = undefined,
		stackColumnsAt = undefined,
		builderLinkComponent = undefined,
		reverseColumnsWhenStacked = undefined,
		builderContext,
		builderBlock,
		builderComponents
	}: {
		space?: number;
		columns?: Column[];
		stackColumnsAt?: 'tablet' | 'mobile' | 'never';
		builderLinkComponent?: unknown;
		reverseColumnsWhenStacked?: boolean;
		builderContext: Writable<Record<string, any>>;
		builderBlock: BuilderBlock;
		builderComponents: RegisteredComponents;
		[k: string]: unknown;
	} = $props();

	// svelte-ignore state_referenced_locally
	const ctx = get(builderContext);
	const cols = $derived(columns || []);
	const gutter = $derived(typeof space === 'number' ? space || 0 : 20);
	const stack_at = $derived(stackColumnsAt || 'tablet');
	const flex_dir = $derived(stackColumnsAt === 'never' ? 'row' : reverseColumnsWhenStacked ? 'column-reverse' : 'column');

	const tablet = (stacked: string | number, desktop: string | number) => (stack_at === 'tablet' ? stacked : desktop);
	const mobile = (stacked: string | number, desktop: string | number) => (stack_at === 'never' ? desktop : stacked);

	function width_of(i: number): string {
		const width = cols[i]?.width || 100 / cols.length;
		const subtract = gutter * (cols.length - 1) * (width / 100);
		return `calc(${width}% - ${subtract}px)`;
	}

	/** official `getAttributes(column, index)` — the column's style text (svelte `mapStyleObjToStrIfNeeded`). */
	function column_style(i: number): string {
		const g = `${i === 0 ? 0 : gutter}px`;
		const w = width_of(i);
		// official convertStyleMapToCSSArray: only string values, `key: value;` joined by ' '
		const parts = ['display: flex;', 'flex-direction: column;', 'align-items: stretch;', `width: ${w};`, `margin-left: ${g};`];
		const m_w = mobile('100%', w);
		const m_ml = mobile(0, g);
		const t_w = tablet('100%', w);
		const t_ml = tablet(0, g);
		if (typeof m_w === 'string') parts.push(`--column-width-mobile: ${m_w};`);
		if (typeof m_ml === 'string') parts.push(`--column-margin-left-mobile: ${m_ml};`);
		if (typeof t_w === 'string') parts.push(`--column-width-tablet: ${t_w};`);
		if (typeof t_ml === 'string') parts.push(`--column-margin-left-tablet: ${t_ml};`);
		return parts.join(' ');
	}

	function columns_css(): string {
		const sizes = sizes_for(ctx.content?.meta?.breakpoints || {});
		const child = `.${builderBlock.id}-breakpoints > .builder-column`;
		return `
        @media (max-width: ${sizes.medium.max}px) {
          .${builderBlock.id}-breakpoints {
            flex-direction: var(--flex-dir-tablet);
            align-items: stretch;
          }

          ${child} {
            width: var(--column-width-tablet) !important;
            margin-left: var(--column-margin-left-tablet) !important;
          }
        }

        @media (max-width: ${sizes.small.max}px) {
          .${builderBlock.id}-breakpoints {
            flex-direction: var(--flex-dir);
            align-items: stretch;
          }

          ${child} {
            width: var(--column-width-mobile) !important;
            margin-left: var(--column-margin-left-mobile) !important;
          }
        },
      `;
	}
</script>

<div
	style={stringify_styles({ '--flex-dir': flex_dir, '--flex-dir-tablet': tablet(flex_dir, 'row') })}
	class={`builder-columns ${builderBlock?.id}-breakpoints div`}
>
	{@html `<style data-id="builderio-columns" nonce="${ctx.nonce ?? ''}">${columns_css()}</style>`}
	{#each columns ?? [] as column, index (index)}
		{@const attrs = { ...(column.link ? { href: column.link } : {}), class: 'builder-column', style: column_style(index) }}
		{#if column.link && builderLinkComponent}
			{@const Link = builderLinkComponent as any}
			<Link {...attrs}>{@render column_blocks(column, index)}</Link>
		{:else}
			<svelte:element this={column.link ? 'a' : 'div'} {...attrs}>{@render column_blocks(column, index)}</svelte:element>
		{/if}
	{/each}
</div>

{#snippet column_blocks(column: Column, index: number)}
	<Blocks
		path={`columns.${index}.blocks`}
		parent={builderBlock.id}
		context={builderContext}
		registeredComponents={builderComponents}
		linkComponent={builderLinkComponent}
		blocks={column.blocks}
		styleProp={{ flexGrow: '1' }}
	/>
{/snippet}

<style>
	.div {
		display: flex;
		line-height: normal;
		height: 100%;
	}
</style>
