<script lang="ts">
	let { text = undefined }: { text?: unknown; [k: string]: unknown } = $props();
</script>

<div style="outline:none;" class="builder-text">
	{@html text?.toString() || ''}
</div>
