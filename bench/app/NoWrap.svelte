<script>
	// A noWrap component (field header/footer shape): the SDK's wrapper attributes land on its root.
	import { texts } from './sdk.js';
	export let attributes = {};
	export let builderBlock = undefined;
	$: labels = texts($$props);
</script>

<footer {...attributes} data-name={builderBlock?.component?.name}>
	{#each labels as label}<span>{label}</span>{/each}
	<slot />
</footer>
