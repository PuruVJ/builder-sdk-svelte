<script lang="ts">
	/** A repeated block: one Block per item, each with the item's state layer (official RepeatedBlock). */
	import type { Compiled } from '../internal/compile.js';
	import type { Scope } from '../internal/scope.js';
	import { repeat_scopes } from '../internal/render.js';
	import Block from './Block.svelte';

	let { compiled, scope }: { compiled: Compiled; scope: Scope } = $props();
	const items = $derived((scope.ctx.version(), repeat_scopes(compiled, scope)));
</script>

{#if items?.length}
	{#if compiled.css && !scope.ctx.plan.in_sheet.has(compiled.src)}
		{@html `<style data-id="builderio-block" nonce="${scope.ctx.nonce}">${compiled.css}</style>`}
	{/if}
	{#each items as item_scope}
		<Block block={compiled.repeat!.block} scope={item_scope} item />
	{/each}
{/if}
