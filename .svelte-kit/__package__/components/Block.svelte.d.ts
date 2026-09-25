import type { BuilderBlock } from '../types.js';
import type { Compiled } from '../internal/compile.js';
import type { Scope } from '../internal/scope.js';
import Block from './Block.svelte';
type $$ComponentProps = {
    block: BuilderBlock;
    scope: Scope;
    item?: boolean;
    bound?: Compiled;
};
declare const Block: import("svelte").Component<$$ComponentProps, {}, "">;
type Block = ReturnType<typeof Block>;
export default Block;
