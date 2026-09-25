<script lang="ts">
	/**
	 * `<Content>` — the official public component (ContentVariants): A/B variants, then the content.
	 *
	 * During SSR with A/B variations every variant renders hidden next to the default (the official
	 * Svelte strategy: a cookie script picks the winner before paint); after mount only the winner stays.
	 * Inside Builder's visual editor (or a preview link) the page hands off to the official SDK's
	 * `<Content>` in the browser; real visitors never load it.
	 */
	import { onMount, type Component } from 'svelte';
	import type { BuilderContent, RegisteredComponent } from '../types.js';
	import {
		get_variants,
		handle_ab_testing,
		INIT_PERSONALIZATION_FNS,
		INIT_VARIANTS_FNS,
		script_tag,
		style_tag,
		update_cookie_and_styles_script
	} from '../internal/ab-tests.js';
	import { is_editing, is_previewing } from '../internal/env.js';
	import { plan_of } from '../internal/content.js';
	import { set_can_track } from '../internal/user-attributes.js';
	import ContentView from './ContentView.svelte';

	let props: {
		content?: BuilderContent | null;
		model?: string;
		data?: Record<string, unknown>;
		context?: Record<string, unknown>;
		apiKey?: string;
		apiHost?: string;
		apiVersion?: string;
		customComponents?: RegisteredComponent[];
		canTrack?: boolean;
		locale?: string;
		enrich?: boolean;
		linkComponent?: unknown;
		blocksWrapper?: unknown;
		blocksWrapperProps?: Record<string, unknown>;
		contentWrapper?: string;
		contentWrapperProps?: Record<string, unknown>;
		trustedHosts?: string[];
		nonce?: string;
		isNestedRender?: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally
	const can_track = props.canTrack ?? true;
	set_can_track(can_track);
	// svelte-ignore state_referenced_locally
	const variants = get_variants(props.content);
	let render_variants = $state(variants.length > 0 && can_track);
	// The page-level helper scripts this content needs — from the plan's one walk (cached; the view
	// below renders from the same plan).
	// svelte-ignore state_referenced_locally
	const flags = props.isNestedRender || !props.content ? null : plan_of({ ...props, model: props.model ?? '' } as never).flags;
	const nonce = $derived(props.nonce || '');

	const default_content = $derived(
		render_variants
			? { ...props.content, testVariationId: props.content?.id }
			: handle_ab_testing(props.content, can_track)
	);

	let Official: Component<any> | null = $state(null);
	onMount(() => {
		render_variants = false;
		if (!props.isNestedRender && (is_editing() || is_previewing())) {
			// @ts-ignore optional peer — the official SDK, loaded only inside the editor / a preview
			import('@builder.io/sdk-svelte/bundle/browser').then((m) => (Official = m.Content as never)).catch(() => {});
		}
	});
</script>

{#if Official}
	<Official {...props} />
{:else}
	{#if flags && (flags.ab || variants.length)}
		{@html script_tag('builderio-init-variants-fns', nonce, INIT_VARIANTS_FNS)}
	{/if}
	{#if flags?.personalization}
		{@html script_tag('builderio-init-personalization-variants-fns', nonce, INIT_PERSONALIZATION_FNS)}
	{/if}
	{#if render_variants}
		{@html style_tag(
			'builderio-variants',
			nonce,
			variants.map((v) => `.variant-${v.testVariationId} { display: none; } `).join('')
		)}
		{@html script_tag(
			'builderio-variants-visibility',
			nonce,
			update_cookie_and_styles_script(
				variants.map((v) => ({ id: v.testVariationId, testRatio: v.testRatio })),
				props.content?.id || ''
			)
		)}
		{#each variants as variant}
			<ContentView {...props} content={variant} showContent={false} isSsrAbTest={true} />
		{/each}
	{/if}
	<!-- keyed by the variation: the default winning after mount keeps the same DOM -->
	{#key default_content?.testVariationId}
		<ContentView {...props} content={default_content} showContent={true} isSsrAbTest={render_variants} />
	{/key}
{/if}
