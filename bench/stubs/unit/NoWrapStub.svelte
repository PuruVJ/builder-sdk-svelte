<script lang="ts">
	// A noWrap component (tests/unit/components): the block's wrapper attributes land on its own root.
	import { digest } from '../stub.js';
	let props: Record<string, any> = $props();
	const attrs = $derived.by(() => {
		const out: Record<string, unknown> = {};
		for (const key in props.attributes ?? {}) if (!key.startsWith('on')) out[key] = props.attributes[key];
		return out;
	});
</script>

<article {...attrs} data-nowrap={props.builderBlock?.component?.name} data-echo={digest(props)}>{@render props.children?.()}</article>
