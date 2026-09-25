<script lang="ts">
	/**
	 * A list of blocks in a `builder-blocks` wrapper — the public `<Blocks>` custom components render
	 * their nested content with (official props and markup). It renders in the scope of the nearest
	 * `<Content>` / repeat item, or of the `context` store it is handed.
	 */
	import { getContext } from 'svelte';
	import type { BuilderBlock, RegisteredComponent, RegisteredComponents } from '../types.js';
	import { kebab } from '../internal/css.js';
	import { SCOPE_KEY } from '../internal/keys.js';
	import { registry_for } from '../internal/registry.js';
	import { plan_for } from '../internal/compile.js';
	import { scope_of_store, Scope } from '../internal/scope.js';
	import { plain_html } from '../internal/plain.js';
	import { view } from './Block.svelte';

	let {
		blocks,
		parent = undefined,
		path = undefined,
		styleProp = undefined,
		BlocksWrapperProps = undefined,
		context = undefined,
		className = undefined,
		linkComponent = undefined,
		registeredComponents = undefined,
		children
	}: {
		blocks?: BuilderBlock[];
		parent?: string;
		path?: string;
		styleProp?: Record<string, unknown>;
		BlocksWrapperProps?: Record<string, unknown>;
		context?: unknown;
		className?: string;
		linkComponent?: unknown;
		registeredComponents?: RegisteredComponents | RegisteredComponent[];
		children?: import('svelte').Snippet;
	} = $props();

	const inherited = getContext<(() => Scope) | undefined>(SCOPE_KEY);

	/** The scope to render in: the handed store's, else the inherited one — re-pointed only when a
	 *  different registry or link component is asked for (rare: a custom component passing its own). */
	function resolve(): Scope | undefined {
		const base = scope_of_store(context) ?? inherited?.();
		if (!base) return undefined;
		const want_registry = registeredComponents ? registry_for(registeredComponents) : base.ctx.registry;
		const want_link = linkComponent ?? base.ctx.link_component;
		if (want_registry === base.ctx.registry && want_link === base.ctx.link_component) return base;
		// Inherit the context through the prototype (its live `root` getter stays live); a different
		// registry compiles into its own plan (a block's compiled record depends on the registry).
		const ctx = Object.create(base.ctx);
		ctx.link_component = want_link;
		if (want_registry !== base.ctx.registry) {
			ctx.registry = want_registry;
			ctx.plan = plan_for(base.ctx.plan, { ...base.ctx.plan.options, registry: want_registry }, undefined);
		}
		return new Scope(ctx, base.local);
	}
	// svelte-ignore state_referenced_locally
	const scope = resolve();

	function data_path(): string | undefined {
		if (!path) return undefined;
		if (path.startsWith('this.')) return path.replace('this.', '');
		if (path.startsWith('component.options.')) return path;
		return 'component.options.' + path;
	}

	function style_of(obj: Record<string, unknown> | undefined): string {
		let out = '';
		if (obj) for (const key in obj) out += kebab(key) + ':' + obj[key] + ';';
		return out;
	}

	const wrapper = $derived(
		(scope?.ctx.blocks_wrapper as string | undefined) && typeof scope?.ctx.blocks_wrapper === 'string'
			? (scope.ctx.blocks_wrapper as string)
			: 'div'
	);
	const wrapper_props = $derived(BlocksWrapperProps ?? scope?.ctx.blocks_wrapper_props);

	/**
	 * The list as runs: a run of plain blocks (no behaviour anywhere in them, internal/plain.ts) is
	 * ONE html string; a live block is a <Block>. A 1 000-block list of text is then one `{@html}`
	 * instead of 1 000 components. Byte-identical: a live <Block> emits one space before its content,
	 * so each plain block contributes ' ' + its html. Runs are objects (fresh per list), so the keyed
	 * each never sees a duplicate key and a changed list replaces its strings.
	 */
	type Segment = BuilderBlock | { html: string };
	function segments(list: BuilderBlock[], s: Scope): Segment[] {
		const plan = s.ctx.plan;
		const link = !!s.ctx.link_component;
		const out: Segment[] = [];
		let run: { html: string } | null = null;
		for (let i = 0; i < list.length; i++) {
			const block = list[i];
			const c = plan.compile(block);
			const html = c.bindings || c.repeat ? null : plain_html(plan, c);
			if (html !== null && !(link && c.links)) {
				if (run) run.html += ' ' + html;
				else out.push((run = { html: ' ' + html }));
			} else {
				run = null;
				out.push(block);
			}
		}
		return out;
	}
	const list = $derived(blocks && scope ? segments(blocks, scope) : []);
</script>

<svelte:element
	this={wrapper}
	style={style_of(styleProp)}
	class={'builder-blocks' + (blocks?.length ? '' : ' no-blocks') + (className ? ' ' + className : '') + ' svelteelement'}
	builder-path={data_path()}
	builder-parent-id={parent}
	{...wrapper_props}
	>{@render children?.()}{#each list as seg (seg)}{#if 'html' in seg}{@html seg.html}{:else}{@render view(seg, scope)}{/if}{/each}</svelte:element
>

<style>
	.svelteelement {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}
</style>
