<script lang="ts">
	import { all_attrs } from './helpers.js';

	let {
		attributes = undefined,
		text = undefined
	}: { attributes?: Record<string, unknown>; text?: string; [k: string]: unknown } = $props();
</script>

<button type="submit" {...all_attrs(attributes)}>{text}</button>
