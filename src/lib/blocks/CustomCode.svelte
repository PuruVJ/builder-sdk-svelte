<script lang="ts">
	import { onMount } from 'svelte';
	import { run_scripts } from './scripts.js';
	import { is_editing } from '../internal/env.js';
	let { code, replaceNodes = undefined }: { code: string; replaceNodes?: boolean; [k: string]: unknown } = $props();
	let el: HTMLElement | undefined = $state();
	const inserted: string[] = [];
	const run: string[] = [];
	onMount(() => run_scripts(el, inserted, run, 'CustomCode'));
	// In the editor, edited code runs its (new) scripts once the new HTML is in (official onUpdate).
	let first = true;
	$effect(() => {
		code;
		if (first) {
			first = false;
			return;
		}
		if (is_editing()) setTimeout(() => run_scripts(el, inserted, run, 'CustomCode'), 0);
	});
</script>

<div bind:this={el} class={'builder-custom-code' + (replaceNodes ? ' replace-nodes' : '')}>
	{@html code}
</div>
