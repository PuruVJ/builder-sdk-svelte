<script lang="ts">
	// A registered component that throws while rendering (ours only: the official render throws too).
	let props: Record<string, any> = $props();
	// svelte-ignore state_referenced_locally
	if (props.explode) throw new Error('component exploded');
</script>

<p class="did-not-throw">fine</p>
