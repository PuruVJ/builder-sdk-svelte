<script lang="ts">
	/** A block with bindings: re-applies them when root state changes (one derived per bound block). */
	import type { BuilderBlock } from '../types.js';
	import type { Compiled } from '../internal/compile.js';
	import type { Scope } from '../internal/scope.js';
	import { process } from '../internal/render.js';
	import Block from './Block.svelte';

	let { block, scope: scope_prop, compiled }: { block: BuilderBlock; scope: Scope; compiled: Compiled } = $props();
	// A plain const, not the prop: see Block.svelte (a passed-through prop is a getter chain).
	// svelte-ignore state_referenced_locally
	const scope = scope_prop;
	const c = $derived((scope.ctx.version(), process(compiled, scope)));
</script>

<Block {block} {scope} bound={c} />
