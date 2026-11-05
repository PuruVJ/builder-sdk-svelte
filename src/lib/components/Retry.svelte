<script lang="ts">
	/** A block whose component threw (live only): it renders nothing, and is tried again when the editor next changes it. */
	let { c, reset }: { c: unknown; reset: () => void } = $props();
	let first = true;
	$effect.pre(() => {
		void c;
		if (first) {
			first = false;
			return;
		}
		reset();
	});
</script>
