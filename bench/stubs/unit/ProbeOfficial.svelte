<script lang="ts">
	// Renders a <Blocks> with the props its `probe` option asks for (tests/unit/components): the
	// public <Blocks> props, rendered the same way through each SDK (ProbeOurs is the same file).
	import { Blocks } from '@builder.io/sdk-svelte';
	let props: Record<string, any> = $props();
	const p = $derived(props.probe ?? {});
	const blocks = $derived(p.from ? props[p.from] : props.builderBlock?.children);
</script>

<div class="probe">
	<Blocks
		{blocks}
		parent={p.parent === false ? undefined : (p.parent ?? props.builderBlock?.id)}
		path={p.path}
		styleProp={p.styleProp}
		className={p.className}
		BlocksWrapperProps={p.BlocksWrapperProps}
		context={p.context ? props.builderContext : undefined}
		registeredComponents={p.registry === 'pass' ? props.builderComponents : p.registry === 'list' ? p.list : undefined}
		linkComponent={p.link ? props.builderLinkComponent : undefined}
		>{#if p.slot}<i class="probe-slot">slot</i>{/if}</Blocks
	>
</div>
