/** A repeated block: one Block per item, each with the item's state layer (official RepeatedBlock). */
import type { Compiled } from '../internal/compile.js';
import type { Scope } from '../internal/scope.js';
type $$ComponentProps = {
    compiled: Compiled;
    scope: Scope;
};
declare const Repeat: import("svelte").Component<$$ComponentProps, {}, "">;
type Repeat = ReturnType<typeof Repeat>;
export default Repeat;
