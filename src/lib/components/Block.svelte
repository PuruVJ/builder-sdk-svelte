<script lang="ts">
	/**
	 * One block. The official SDK renders each block through ~9 components (Block → StyleWrapper →
	 * BlockStyles → InlinedStyles, BlockWrapper → DynamicRenderer → ComponentRef → InteractiveElement →
	 * the component) with ~25 derived values each on the client. Here a STATIC block is this one
	 * component with no reactive state at all: its compiled record is read once. Only a block with
	 * bindings (Bound) or a repeat (Repeat) gets reactive state, re-deriving when root state changes.
	 */
	import { onMount, setContext } from 'svelte';
	import { bind_animations, type Animation } from '../internal/animator.js';
	import type { BuilderBlock } from '../types.js';
	import type { Compiled } from '../internal/compile.js';
	import type { Scope } from '../internal/scope.js';
	import { component_props, wrapper_attrs } from '../internal/render.js';
	import { SCOPE_KEY } from '../internal/keys.js';
	import { plain_html } from '../internal/plain.js';
	import { block_style } from '../internal/tags.js';
	import Block from './Block.svelte';
	import Bound from './Bound.svelte';
	import Repeat from './Repeat.svelte';
	import Awaiter from './Awaiter.svelte';

	let {
		block,
		scope: scope_prop,
		item = false,
		bound
	}: { block: BuilderBlock; scope: Scope; item?: boolean; bound?: Compiled } = $props();

	// The scope as a plain const. Passing the prop straight down (`<Block {scope} />`) makes each
	// level's `scope` a getter that calls its parent's getter: reading it at depth N walks N frames
	// (O(N²) over a tree), and a 200-deep tree overflowed the browser's stack during hydration.
	// svelte-ignore state_referenced_locally
	const scope = scope_prop;

	// Read once: a block's content and scope do not change under a mounted block (a content change
	// re-keys the whole <Content>). svelte-ignore: deliberate non-reactive reads.
	// svelte-ignore state_referenced_locally
	const compiled = scope.ctx.plan.compile(block);
	// svelte-ignore state_referenced_locally
	const static_block = !compiled.bindings && !compiled.repeat;
	// A repeat item is its own state layer: <Blocks> inside its components must see the item's scope
	// (the official RepeatedBlock sets a new context per item).
	// svelte-ignore state_referenced_locally
	if (item) setContext(SCOPE_KEY, () => scope);
	// Animations bind after mount — a lifecycle hook only for a block that has them.
	// svelte-ignore state_referenced_locally
	if (compiled.src.animations?.length && compiled.id) {
		const id = compiled.id;
		const list = compiled.src.animations as unknown as Animation[];
		onMount(() => bind_animations(list.map((a) => ({ ...a, elementId: id }))));
	}

	// ONE dispatch per level, not an if/else-if chain. Each `{#if}` / `{:else if}` / `<svelte:element>`
	// is a nested effect, and the browser hydrates a tree by recursing through every one of them: a
	// chain of ~8 per block overflowed the stack at ~45 levels of nesting. A single dynamic `{@render}`
	// picks the shape; a plain `<div>` (the common tag) is a static element with no effect at all.
	function pick(c: Compiled) {
		if (!bound) {
			if (compiled.repeat) return repeat_s;
			if (compiled.bindings) return bound_s;
			// No behaviour anywhere below: the whole subtree is one HTML string (internal/plain.ts).
			if (plain_html(scope.ctx.plan, compiled) !== null && !(compiled.links && scope.ctx.link_component)) return plain_s;
		}
		if (!c.visible) return null;
		if (c.no_wrap) return c.comp?.component ? component_s : null;
		if (c.is_link && scope.ctx.link_component) return link_s;
		if (c.empty_tag) return empty_s;
		if (c.tag === 'div') return c.comp?.component ? div_comp_s : div_kids_s;
		return element_s;
	}
	/** The block's own style tag when its rules are not already in the content's one sheet. */
	function own_css(c: Compiled): string {
		if (!c.visible || !c.css || (!bound && (compiled.repeat || compiled.bindings))) return '';
		if (static_block && scope.ctx.plan.in_sheet.has(block)) return '';
		return block_style(scope.ctx.nonce, c.css);
	}
</script>

{@html own_css(bound ?? compiled)}
{@render pick(bound ?? compiled)?.(bound ?? compiled)}

{#snippet plain_s(c)}
	{@html c.html}
{/snippet}

{#snippet repeat_s(_c)}
	<Repeat {compiled} {scope} />
{/snippet}

{#snippet bound_s(_c)}
	<Bound {block} {scope} {compiled} />
{/snippet}

{#snippet div_kids_s(c)}
	<!-- Also an entry registered WITHOUT a component (an app "removing" a built-in): the wrapper and
	     the block's children, like the official SDK. -->
	<div {...wrapper_attrs(c, scope, false)}>{#each c.children as child (child)}<Block block={child} {scope} />{/each}</div>
{/snippet}

{#snippet div_comp_s(c)}
	<div {...wrapper_attrs(c, scope, false)}>{@render component_s(c)}</div>
{/snippet}

{#snippet element_s(c)}
	<svelte:element this={c.tag} {...wrapper_attrs(c, scope, false)}>{@render inner(c)}</svelte:element>
{/snippet}

{#snippet empty_s(c)}
	<svelte:element this={c.tag} {...wrapper_attrs(c, scope, false)} />
{/snippet}

{#snippet link_s(c)}
	{@const Tag = scope.ctx.link_component}
	<Tag {...wrapper_attrs(c, scope, true)}>{@render inner(c)}</Tag>
{/snippet}

{#snippet inner(c)}
	{#if c.comp?.component}
		{@render component_s(c)}
	{:else}
		{#each c.children as child (child)}<Block block={child} {scope} />{/each}
	{/if}
{/snippet}

{#snippet component_s(c)}
	<!-- (templates are plain JS: the component ships as source and the app compiles it) -->
	{@const Comp = c.comp.component}
	{#if Comp.load}
		<Awaiter load={Comp.load} fallback={Comp.fallback} props={component_props(c, scope)}>
			{#each c.children as child (child)}<Block block={child} {scope} />{/each}
		</Awaiter>
	{:else}
		<Comp {...component_props(c, scope)}>
			{#each c.children as child (child)}<Block block={child} {scope} />{/each}
		</Comp>
	{/if}
{/snippet}
