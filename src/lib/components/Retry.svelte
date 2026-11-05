<script lang="ts">
	/** A block whose component threw (live only): it renders nothing, and is tried again when the editor next changes it. */
	import Run from './Run.svelte';

	let { c, reset }: { c: unknown; reset: () => void } = $props();
	let failed_with = true;
	function retry() {
		// (the first run is the failure itself: only a later change of the block retries)
		if (failed_with) failed_with = false;
		else reset();
	}
</script>

{#key c}<Run run={retry} />{/key}
