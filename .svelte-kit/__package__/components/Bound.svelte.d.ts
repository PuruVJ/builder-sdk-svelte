/** A block with bindings: re-applies them when root state changes (one derived per bound block). */
import type { BuilderBlock } from '../types.js';
import type { Compiled } from '../internal/compile.js';
import type { Scope } from '../internal/scope.js';
type $$ComponentProps = {
    block: BuilderBlock;
    scope: Scope;
    compiled: Compiled;
};
declare const Bound: import("svelte").Component<$$ComponentProps, {}, "">;
type Bound = ReturnType<typeof Bound>;
export default Bound;
