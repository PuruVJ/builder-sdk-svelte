<script lang="ts">
	let { text = undefined, attributes = {} }: { text?: unknown; attributes?: Record<string, any>; [k: string]: unknown } = $props();
</script>

<div class={attributes.class}>{@html text?.toString() || ''}</div>
