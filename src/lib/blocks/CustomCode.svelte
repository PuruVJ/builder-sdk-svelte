<script lang="ts">
	import { run_scripts } from './scripts.js';
	import { is_editing } from '../internal/env.js';
	import Run from '../components/Run.svelte';
	let { code, replaceNodes = undefined }: { code: string; replaceNodes?: boolean; [k: string]: unknown } = $props();
	let el: HTMLElement | undefined = $state();
	const inserted: string[] = [];
	const run: string[] = [];
	// Its scripts run after mount; in the editor, edited code runs its (new) scripts once the new HTML
	// is in (official onUpdate).
	let mounted = false;
	function scripts() {
		if (!mounted) {
			mounted = true;
			run_scripts(el, inserted, run, 'CustomCode');
		} else if (is_editing()) setTimeout(() => run_scripts(el, inserted, run, 'CustomCode'), 0);
	}
</script>

<div bind:this={el} class={'builder-custom-code' + (replaceNodes ? ' replace-nodes' : '')}>
	{@html code}
</div>
{#key code}<Run run={scripts} />{/key}
