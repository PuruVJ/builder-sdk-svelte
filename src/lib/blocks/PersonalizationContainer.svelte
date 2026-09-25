<script lang="ts">
	import { onMount } from 'svelte';
	import { get, type Writable } from 'svelte/store';
	import type { BuilderBlock, RegisteredComponents } from '../types.js';
	import { is_editing, is_previewing } from '../internal/env.js';
	import { get_user_attributes_cookie, on_user_attributes } from '../internal/user-attributes.js';
	import { all_attrs } from './helpers.js';
	import { variants_style } from '../internal/tags.js';
	import { blocks_to_render, DEFAULT_INDEX, filter_variants, script_tag, scripts_for, type Variant } from './personalization.js';
	import Blocks from '../components/Blocks.svelte';

	let {
		builderContext,
		variants = undefined,
		builderBlock,
		attributes = {},
		previewingIndex = undefined,
		builderComponents
	}: {
		builderContext: Writable<Record<string, any>>;
		variants?: Variant[];
		builderBlock: BuilderBlock;
		attributes?: Record<string, any>;
		previewingIndex?: number | null;
		builderComponents: RegisteredComponents;
		[k: string]: unknown;
	} = $props();

	// svelte-ignore state_referenced_locally
	const ctx = get(builderContext);
	const locale = ctx?.rootState?.locale as string | undefined;
	// svelte-ignore state_referenced_locally
	const id = builderBlock?.id || 'none';
	// svelte-ignore state_referenced_locally
	const list = variants || [];
	const can_track = ctx?.canTrack ?? true;
	const should_render_variants = list.length > 0 && !!can_track;
	const scripts = should_render_variants ? scripts_for(list, id, locale) : null;
	const nonce = ctx?.nonce || '';

	let user_attrs = $state(get_user_attributes_cookie());
	let reset = $state(false);
	let root: HTMLElement | undefined = $state();

	function filtered(): Variant[] {
		return filter_variants(list, { ...(locale ? { locale } : {}), ...user_attrs });
	}
	function chosen() {
		return blocks_to_render(variants, builderBlock?.children, reset, filtered(), previewingIndex);
	}
	function wrapper_props(index: number | string, hidden: boolean) {
		const out: Record<string, unknown> = { ...ctx?.BlocksWrapperProps };
		if (hidden) {
			out['aria-hidden'] = true;
			out.hidden = true;
		}
		out['data-variant-id'] = `${builderBlock?.id}-${index}`;
		return out;
	}
	function attrs() {
		const out = all_attrs(attributes);
		out.class = `builder-personalization-container ${attributes.class || ''}`;
		return out;
	}

	onMount(() => {
		reset = true;
		const unsub = on_user_attributes((a) => (user_attrs = a));
		if (!(is_editing() || is_previewing()) && root) {
			const variant = filtered()[0];
			const detail = { variant: variant || DEFAULT_INDEX, content: ctx?.content };
			root.dispatchEvent(new CustomEvent('builder.variantLoaded', { detail, bubbles: true }));
			const observer = new IntersectionObserver((entries) => {
				for (const e of entries) {
					if (e.isIntersecting && root) root.dispatchEvent(new CustomEvent('builder.variantDisplayed', { detail, bubbles: true }));
				}
			});
			observer.observe(root);
			return () => {
				unsub();
				observer.disconnect();
			};
		}
		return unsub;
	});

	const inline_script = (sid: string, s: string) => script_tag(sid, nonce, s);
</script>

<div bind:this={root} {...attrs()}>
	{#if reset}
		{@const c = chosen()}
		<Blocks
			blocks={c.blocks}
			parent={builderBlock?.id}
			path={c.path}
			context={builderContext}
			registeredComponents={builderComponents}
			BlocksWrapperProps={wrapper_props(c.index, false)}
		/>
	{:else}
		{#if scripts}
			{@html variants_style(builderBlock?.id, nonce, scripts.hide_styles)}
			{@html inline_script(`variants-visibility-script-${builderBlock?.id}`, scripts.visibility)}
			{#each list as variant, index}
				<Blocks
					BlocksWrapperProps={wrapper_props(index, true)}
					blocks={variant.blocks}
					parent={builderBlock?.id}
					path={`component.options.variants.${index}.blocks`}
					context={builderContext}
					registeredComponents={builderComponents}
					>{@html inline_script(`variants-script-${builderBlock?.id}-${index}`, scripts.personalization)}</Blocks
				>
			{/each}
		{/if}
		{@const c = chosen()}
		<Blocks
			blocks={c.blocks}
			parent={builderBlock?.id}
			path={c.path}
			context={builderContext}
			registeredComponents={builderComponents}
			BlocksWrapperProps={wrapper_props(c.index, false)}
			>{#if scripts}{@html inline_script(`variants-script-${builderBlock?.id}-${DEFAULT_INDEX}`, scripts.personalization)}{/if}</Blocks
		>
	{/if}
</div>
