<script lang="ts">
	import { onMount } from 'svelte';
	import { run_scripts } from './scripts.js';
	let { code, replaceNodes = undefined }: { code: string; replaceNodes?: boolean; [k: string]: unknown } = $props();
	let el: HTMLElement | undefined = $state();
	const inserted: string[] = [];
	const run: string[] = [];
	onMount(() => run_scripts(el, inserted, run, 'CustomCode'));
</script>

<div bind:this={el} class={'builder-custom-code' + (replaceNodes ? ' replace-nodes' : '')}>
	{@html code}
</div>
