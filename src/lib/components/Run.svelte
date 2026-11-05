<script lang="ts">
	/**
	 * Calls `run` once, after mount (never on the server). Inside `{#key value}` it calls it again
	 * when `value` changes — an imperative call where an `$effect` would track state: nothing here
	 * reads state, so nothing it does can re-trigger it.
	 */
	import { onMount } from 'svelte';

	let { run }: { run: () => void | (() => void) } = $props();
	// svelte-ignore state_referenced_locally
	onMount(run);
</script>
