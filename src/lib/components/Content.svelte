<script lang="ts">
	/**
	 * `<Content>` — the official public component (ContentVariants): A/B variants, then the content.
	 *
	 * During SSR with A/B variations every variant renders hidden next to the default (the official
	 * Svelte strategy: a cookie script picks the winner before paint); after mount only the winner stays.
	 * Inside Builder's visual editor (or a preview link) the view turns live after mount: it takes the
	 * editor's edits (internal/live.ts). Real visitors never run any of that.
	 */
	import { onMount } from 'svelte';
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
	import { plan_of } from '../internal/content.js';
	import { is_authoring } from '../internal/live.js';
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
		/** (internal: a symbol inside a live tree — a client render, never hydrating — starts live) */
		startLive?: boolean;
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

	// Inside Builder, after mount: the view is rendered again, live (never while hydrating — the
	// server rendered the static shape).
	// svelte-ignore state_referenced_locally
	let live = $state(props.startLive === true);

	// a new content object (even with the same id), another winning variation, or going live
	// re-renders the view
	let view_key = {};
	let keyed_content: unknown = undefined;
	let keyed_variation: unknown = undefined;
	// svelte-ignore state_referenced_locally
	let keyed_live = live;
	const content_key = $derived.by(() => {
		const c = props.content;
		const v = default_content?.testVariationId;
		if (c !== keyed_content || v !== keyed_variation || live !== keyed_live) {
			keyed_content = c;
			keyed_variation = v;
			keyed_live = live;
			view_key = {};
		}
		return view_key;
	});

	const view_props = $derived.by(() => {
		const { startLive: _, ...rest } = props;
		return rest;
	});

	onMount(() => {
		render_variants = false;
		if (!live && is_authoring()) live = true;
	});
</script>

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
		<ContentView {...view_props} content={variant} showContent={false} isSsrAbTest={true} />
	{/each}
{/if}
{#key content_key}
	<ContentView {...view_props} content={default_content} showContent={true} isSsrAbTest={render_variants} {live} />
{/key}
