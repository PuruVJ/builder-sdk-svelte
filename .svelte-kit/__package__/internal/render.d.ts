import type { Compiled } from './compile.js';
import type { Scope } from './scope.js';
/**
 * A block with bindings: its bindings applied to a copy-on-write copy of the block (only the objects
 * along each bound path are copied), compiled fresh — the official `getProcessedBlock`, once per
 * render instead of ~107 times, and without the whole-subtree JSON clone.
 */
export declare function process(c: Compiled, scope: Scope): Compiled;
/** Event handlers for the block's actions (client only — the server renders no handlers). */
export declare function action_handlers(c: Compiled, scope: Scope, prefix: string): Record<string, (e: Event) => unknown>;
/** The wrapper element's attributes: static ones + (client) event handlers. */
export declare function wrapper_attrs(c: Compiled, scope: Scope, component_tag: boolean): Record<string, unknown>;
/** The props a registered component receives (official `getBlockComponentOptions` + provide*). */
export declare function component_props(c: Compiled, scope: Scope): Record<string, unknown>;
/** A repeated block's items (official `getRepeatItemData`), or null when not an array. */
export declare function repeat_scopes(c: Compiled, scope: Scope): Scope[] | null;
