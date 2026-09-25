<script lang="ts">
	import type { Snippet } from 'svelte';
	import { all_attrs } from './helpers.js';
	let {
		attributes = undefined,
		maxWidth = undefined,
		children
	}: { attributes?: Record<string, unknown>; maxWidth?: number; children?: Snippet; [k: string]: unknown } = $props();
</script>

<section
	style="width:100%;align-self:stretch;flex-grow:1;box-sizing:border-box;max-width:{maxWidth || 1200};display:flex;flex-direction:column;align-items:stretch;margin-left:auto;margin-right:auto;"
	{...all_attrs(attributes)}
>
	{@render children?.()}
</section>
