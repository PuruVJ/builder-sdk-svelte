<script>
	// One field page: 4 <Content> roots (accessibility, body, support, footer), each with its own
	// component list, the way the field layout renders them.
	export let Content;
	export let roots = [];
</script>

{#each roots as root}
	<svelte:component this={Content} model={root.model} content={root.content} apiKey="bench" locale={root.locale} customComponents={root.components} data={root.data} canTrack={false} />
{/each}
