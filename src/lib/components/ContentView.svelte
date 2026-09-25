<script lang="ts" module>
	const HTTP_TPL_RE = /{{([^}]+)}}/g;
</script>

<script lang="ts">
	/**
	 * One content render (official ContentComponent + EnableEditor, minus the editor): the wrapper,
	 * the page's one stylesheet, and the blocks from a compiled plan. `<Content>` (the variants
	 * wrapper) renders one of these per content — and one per A/B variant during SSR.
	 */
	import { onMount, setContext } from 'svelte';
	import type { BuilderContent, RegisteredComponent } from '../types.js';
	import { create_content } from '../internal/content.js';
	import { content_styles } from '../internal/content-styles.js';
	import { evaluate } from '../internal/evaluate.js';
	import { SCOPE_KEY } from '../internal/keys.js';
	import { is_editing, is_previewing } from '../internal/env.js';
	import { get_cookie, interaction_properties, track } from '../internal/track.js';
	import { script_tag, update_variant_visibility_script } from '../internal/ab-tests.js';
	import Blocks from './Blocks.svelte';

	let {
		content,
		model = '',
		data = undefined,
		context = undefined,
		apiKey = undefined,
		apiHost = undefined,
		apiVersion = undefined,
		customComponents = undefined,
		canTrack = undefined,
		locale = undefined,
		linkComponent = undefined,
		blocksWrapper = undefined,
		blocksWrapperProps = undefined,
		contentWrapper = 'div',
		contentWrapperProps = undefined,
		nonce = '',
		isNestedRender = false,
		showContent = true,
		isSsrAbTest = false
	}: {
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
		linkComponent?: unknown;
		blocksWrapper?: unknown;
		blocksWrapperProps?: Record<string, unknown>;
		contentWrapper?: string;
		contentWrapperProps?: Record<string, unknown>;
		nonce?: string;
		isNestedRender?: boolean;
		showContent?: boolean;
		isSsrAbTest?: boolean;
	} = $props();

	// The render version: bumped when root state changes (an action, an HTTP request) so the blocks
	// with bindings re-derive. Static blocks never read it.
	let version = $state(0);
	// svelte-ignore state_referenced_locally
	const { ctx, scope } = create_content(
		{
			content,
			model,
			data,
			context,
			apiKey,
			apiHost,
			apiVersion,
			customComponents,
			canTrack,
			locale,
			linkComponent,
			blocksWrapper,
			blocksWrapperProps,
			nonce
		},
		() => version,
		() => version++
	);
	setContext(SCOPE_KEY, () => scope);

	// svelte-ignore state_referenced_locally
	const styles_html =
		`<style data-id="builderio-content" nonce="${nonce}">${content_styles(ctx.content, isNestedRender)}</style>` +
		(ctx.plan.sheet ? `<style data-id="builderio-blocks" nonce="${nonce}">${ctx.plan.sheet}</style>` : '');

	let clicked = false;

	onMount(() => {
		// In the editor / a preview the official SDK takes over this page (Content.svelte) and runs its
		// own requests and tracking — doing them here too would double them.
		if (is_editing() || is_previewing()) return;
		const c = ctx.content;
		if (c && (canTrack ?? true) && apiKey) {
			const winning = get_cookie(`builder.tests.${c.id}`, true);
			if (c.testVariationId === winning) {
				void track({
					apiHost,
					type: 'impression',
					canTrack: true,
					contentId: c.id,
					apiKey,
					variationId: winning !== c.id ? winning : undefined
				});
			}
		}
		run_http_requests();
	});

	function on_click(event: MouseEvent) {
		const c = ctx.content;
		if (c && apiKey) {
			void track({
				apiHost,
				type: 'click',
				canTrack: canTrack ?? true,
				contentId: c.id,
				apiKey,
				variationId: c.testVariationId !== c.id ? c.testVariationId : undefined,
				...interaction_properties(event),
				unique: !clicked
			});
		}
		clicked = true;
	}

	/** official EnableEditor `runHttpRequests` — browser only (the official server run was discarded). */
	function run_http_requests() {
		const requests = (ctx.content?.data?.httpRequests ?? {}) as Record<string, unknown>;
		for (const key in requests) {
			const req = requests[key] as
				| { '@type'?: string; request: { url: string; method?: string; headers?: Record<string, string>; body?: unknown } }
				| string;
			if (!req) continue;
			const request = typeof req === 'object' && req['@type'] === '@builder.io/core:Request' ? req.request : undefined;
			const url = request ? request.url : (req as string);
			const evaluated = url.replace(HTTP_TPL_RE, (_m, code: string) => String(evaluate(code, scope)));
			const method = request?.method ?? 'GET';
			fetch(evaluated, {
				method,
				headers: request?.headers,
				body: method === 'GET' ? undefined : (request?.body as BodyInit | undefined)
			})
				.then((r) => r.json())
				.then((json) => ctx.root_set_state({ ...ctx.root, [key]: json }))
				.catch((err) => console.error('error fetching dynamic data', JSON.stringify(req), err));
		}
	}

	const hidden_props = $derived(showContent ? {} : { hidden: true, 'aria-hidden': true });
</script>

{#if ctx.content}
	<svelte:element
		this={contentWrapper}
		builder-content-id={ctx.content.id}
		builder-model={model}
		classname={'variant-' + (content?.testVariationId || content?.id)}
		onclick={on_click}
		{...hidden_props}
		{...contentWrapperProps}
	>
		{#if isSsrAbTest}
			{@html script_tag(
				'builderio-variant-visibility',
				nonce,
				update_variant_visibility_script(String(content?.testVariationId), String(content?.id))
			)}
		{/if}
		{@html styles_html}
		<Blocks blocks={ctx.content.data?.blocks} />
	</svelte:element>
{/if}
