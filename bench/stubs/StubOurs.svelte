<script lang="ts">
	import { Blocks } from '../../src/lib/index.js';
	import { digest, nested_blocks } from './stub.js';
	let props: Record<string, any> = $props();
</script>

<div class="stub" data-name={props.builderBlock?.component?.name} data-echo={digest(props)}>
	{@render props.children?.()}
	{#each nested_blocks(props) as [key, blocks]}
		<Blocks
			{blocks}
			parent={props.builderBlock?.id}
			path={key}
			context={props.builderContext}
			registeredComponents={props.builderComponents}
		/>
	{/each}
</div>
