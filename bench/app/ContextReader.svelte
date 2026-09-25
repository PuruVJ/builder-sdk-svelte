<script>
	// builderContext consumed as a store (subscribe + $), reading the model and the content's data.
	export let builderContext = undefined;
	let model = '';
	let title = '';
	const stop = builderContext?.subscribe((v) => {
		model = v?.model ?? '';
		title = v?.content?.data?.title ?? '';
	});
	stop?.();
	$: locale = $builderContext?.rootState?.locale ?? '';
</script>

<p class="ctx" data-model={model} data-title={title} data-locale={locale}></p>
