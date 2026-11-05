<script lang="ts">
	// A link component (`linkComponent`, tests/unit/components): every SDK link renders through it.
	let { children, ...rest }: Record<string, any> = $props();
	const attrs = $derived.by(() => {
		const out: Record<string, unknown> = {};
		for (const key in rest) if (!key.startsWith('on') && typeof rest[key] !== 'function') out[key] = rest[key];
		return out;
	});
</script>

<a data-link-component="" {...attrs}>{@render children?.()}</a>
