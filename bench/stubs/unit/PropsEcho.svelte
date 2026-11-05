<script lang="ts">
	// Which builder props a component received (shouldReceiveBuilderProps, tests/unit/components).
	let props: Record<string, any> = $props();
	const keys = $derived(
		Object.keys(props)
			.filter((k) => k.startsWith('builder'))
			.sort()
			.join(',')
	);
	/** What the builderContext store holds (read once, the way an app component reads it). */
	function read(ctx: any): { model: string; state: string } {
		let out = { model: '', state: '' };
		ctx?.subscribe?.((v: any) => {
			out = { model: v?.model ?? '', state: Object.keys(v?.rootState ?? {}).sort().join(',') };
		})?.();
		return out;
	}
	const seen = $derived(read(props.builderContext));
</script>

<p
	class="props-echo"
	data-keys={keys}
	data-block={props.builderBlock?.id}
	data-store={typeof props.builderContext?.subscribe}
	data-model={seen.model}
	data-state={seen.state}
	data-link={props.builderLinkComponent ? 'yes' : 'no'}
	data-components={props.builderComponents ? typeof props.builderComponents : 'none'}
>
	{@render props.children?.()}
</p>
