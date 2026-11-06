<script lang="ts">
	// test-only: throws while `boom` is set; counts its mounts
	let { boom = false, label = '' }: { boom?: boolean; label?: string } = $props();
	const g = globalThis as unknown as { __boom_mounts: number };
	g.__boom_mounts = (g.__boom_mounts || 0) + 1;
	const text = $derived.by(() => {
		if (boom) throw new Error('boom: a component failing while it is edited');
		return label;
	});
</script>

<p data-boom>{text}</p>
