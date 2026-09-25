<script lang="ts">
	import { onMount } from 'svelte';
	import { run_scripts } from './scripts.js';
	let { content }: { content: string; [k: string]: unknown } = $props();
	let el: HTMLElement | undefined = $state();
	const inserted: string[] = [];
	const run: string[] = [];
	onMount(() => run_scripts(el, inserted, run, 'Embed'));
</script>

<div class="builder-embed" bind:this={el}>{@html content}</div>
