<script module lang="ts">
	/**
	 * One block. The official SDK renders each block through ~9 components (Block → StyleWrapper →
	 * BlockStyles → InlinedStyles, BlockWrapper → DynamicRenderer → ComponentRef → InteractiveElement →
	 * the component) with ~25 derived values each on the client.
	 *
	 * Here a STATIC block (no bindings, repeat or animations — nearly all of them) is not a component
	 * at all: it renders through the exported `view` snippet, reading its compiled record once. Only a
	 * block with behaviour is a <Block> component instance: bindings (Bound) and repeats (Repeat) get
	 * reactive state, animations a mount hook, a repeat item its own context layer.
	 *
	 * ONE dispatch per level, never an if/else-if chain: each `{#if}` / `{:else if}` /
	 * `<svelte:element>` is a nested effect and the browser hydrates by recursing through them (a chain
	 * of ~8 per block overflowed the stack at ~45 levels). A plain `<div>` (the common tag) is a static
	 * element with no effect at all; a plain subtree is one string (internal/plain.ts).
	 *
	 * Every snippet takes (compiled, scope) and reads nothing else, so they live at module level.
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

	export { view };

	/** A block that needs a component instance of its own (state, a mount hook). */
	function needs_component(c: Compiled): boolean {
		return !!(c.bindings || c.repeat || c.src.animations?.length);
	}

	/** The shape a block renders as (its compiled record final: static, or a bound block's copy). */
	function shape_of(c: Compiled, scope: Scope) {
		if (!c.visible) return null;
		if (c.no_wrap) return c.comp?.component ? component_s : null;
		if (c.is_link && scope.ctx.link_component) return link_s;
		if (c.empty_tag) return empty_s;
		if (c.tag === 'div') return c.comp?.component ? div_comp_s : div_kids_s;
		return element_s;
	}

	/** A static block: its whole subtree as one string when nothing in it has behaviour. */
	function static_shape(c: Compiled, scope: Scope) {
		if (plain_html(scope.ctx.plan, c) !== null && !(c.links && scope.ctx.link_component)) return plain_s;
		return shape_of(c, scope);
	}

	/** A static block's own style tag when its rules are not already in the content's one sheet. */
	function static_css(c: Compiled, scope: Scope): string {
		if (!c.visible || !c.css || scope.ctx.plan.is_in_sheet(c)) return '';
		return block_style(scope.ctx.nonce, c.css);
	}

	function entry_of(c: Compiled) {
		return needs_component(c) ? component_entry_s : static_entry_s;
	}
</script>

<script lang="ts">
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

	function pick(c: Compiled) {
		if (!bound) {
			if (compiled.repeat) return repeat_s;
			if (compiled.bindings) return bound_s;
			return static_shape(c, scope);
		}
		return shape_of(c, scope);
	}
	/** The block's own style tag when its rules are not already in the content's one sheet. */
	function own_css(c: Compiled): string {
		if (!bound && (compiled.repeat || compiled.bindings)) return '';
		if (!bound) return static_css(c, scope);
		return c.visible && c.css ? block_style(scope.ctx.nonce, c.css) : '';
	}
</script>

{@html own_css(bound ?? compiled)}
{@render pick(bound ?? compiled)?.(bound ?? compiled, scope)}

<!-- A block in a list: static ones render right here, the rest as a <Block> instance. -->
{#snippet view(block, scope)}
	{@const c = scope.ctx.plan.compile(block)}
	{@render entry_of(c)(c, scope)}
{/snippet}

{#snippet component_entry_s(c, scope)}
	<Block block={c.src} {scope} />
{/snippet}

<!-- (the same output as a <Block>: its style tag, one space, its shape) -->
{#snippet static_entry_s(c, scope)}
	{@html static_css(c, scope)}
	{@render static_shape(c, scope)?.(c, scope)}
{/snippet}

{#snippet plain_s(c, _scope)}
	{@html c.html}
{/snippet}

{#snippet repeat_s(c, scope)}
	<Repeat compiled={c} {scope} />
{/snippet}

{#snippet bound_s(c, scope)}
	<Bound block={c.src} {scope} compiled={c} />
{/snippet}

{#snippet div_kids_s(c, scope)}
	<!-- Also an entry registered WITHOUT a component (an app "removing" a built-in): the wrapper and
	     the block's children, like the official SDK. -->
	<div {...wrapper_attrs(c, scope, false)}>{#each c.children as child (child)}{@render view(child, scope)}{/each}</div>
{/snippet}

{#snippet div_comp_s(c, scope)}
	<div {...wrapper_attrs(c, scope, false)}>{@render component_s(c, scope)}</div>
{/snippet}

{#snippet element_s(c, scope)}
	<svelte:element this={c.tag} {...wrapper_attrs(c, scope, false)}>{@render inner(c, scope)}</svelte:element>
{/snippet}

{#snippet empty_s(c, scope)}
	<svelte:element this={c.tag} {...wrapper_attrs(c, scope, false)} />
{/snippet}

{#snippet link_s(c, scope)}
	{@const Tag = scope.ctx.link_component}
	<Tag {...wrapper_attrs(c, scope, true)}>{@render inner(c, scope)}</Tag>
{/snippet}

{#snippet inner(c, scope)}
	{#if c.comp?.component}
		{@render component_s(c, scope)}
	{:else}
		{#each c.children as child (child)}{@render view(child, scope)}{/each}
	{/if}
{/snippet}

{#snippet component_s(c, scope)}
	<!-- (templates are plain JS: the component ships as source and the app compiles it) -->
	{@const Comp = c.comp.component}
	{#if Comp.load}
		<Awaiter load={Comp.load} fallback={Comp.fallback} props={component_props(c, scope)}>
			{#each c.children as child (child)}{@render view(child, scope)}{/each}
		</Awaiter>
	{:else}
		<Comp {...component_props(c, scope)}>
			{#each c.children as child (child)}{@render view(child, scope)}{/each}
		</Comp>
	{/if}
{/snippet}
