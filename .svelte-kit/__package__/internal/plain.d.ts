/**
 * PLAIN SUBTREES — a block with no behaviour anywhere below it renders as one HTML string.
 *
 * "No behaviour": no registered component other than a known-plain built-in (Text), no bindings,
 * repeat, actions, animations or `{{state}}` text, and its CSS already in the content's one sheet.
 * Such a subtree needs nothing from Svelte: its markup is the same on every render and no state
 * reaches it. So it is built here as a string, by a LOOP (an explicit stack, not recursion), and
 * rendered through one `{@html}`. That gives:
 *  - no depth limit: hydration never walks into it (Svelte claims the SSR nodes as they are), and
 *    the string is built without nested calls — a 10 000-deep plain chain renders;
 *  - no component, effect or hydration marker per plain block (server and browser);
 *  - identical markup: attributes are serialized with Svelte's own SSR rules (below).
 * Anything with behaviour stays a live <Block>; a plain subtree under it is still plain.
 */
import type { Compiled, Plan } from './compile.js';
/** Off only in tests: the markup-parity test renders every page both ways and compares bytes. */
export declare const PLAIN: {
    on: boolean;
};
/** Built-in components whose whole output is a pure function of the compiled block (no state). */
export declare const PLAIN_COMPONENTS: WeakMap<object, (c: Compiled) => string>;
/** A spread `{...attrs}` on an HTML element, as Svelte's server renders it. */
export declare function attrs_html(attrs: Record<string, unknown>): string;
/**
 * The plain HTML of `root`'s subtree, or null when something in it has behaviour. Computed once per
 * block per plan (cached on the compiled record, with every plain subtree met on the way).
 */
export declare function plain_html(plan: Plan, root: Compiled): string | null;
