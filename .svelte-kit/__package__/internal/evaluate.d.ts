/**
 * Binding evaluation — the official semantics, compiled once.
 *
 * The official SDK builds a fresh `new Function(...)` for every non-trivial binding on every call
 * (~107 calls per block per render), plus a globals object and a Proxy per call. Here each code
 * string is compiled once per process and cached; a render passes a state view built once per scope.
 *
 * Semantics kept: the code sees `state`, `Builder`, `builder`, `context`, `event`; an expression is
 * wrapped in `return (…)` unless it contains `;`, ` return ` or starts with `return ` (official
 * `parseCode`); a throw logs `Failed code evaluation` and yields `undefined`.
 */
export type Globals = {
    isEditing: boolean | undefined;
    isBrowser: boolean | undefined;
    isServer: boolean | undefined;
    getUserAttributes: () => Record<string, unknown>;
    trackConversion: (amount?: number, customProperties?: Record<string, unknown>) => void;
};
type Compiled = (state: unknown, builder: Globals, builder2: Globals, context: unknown, event: unknown) => unknown;
export declare function parse_code(code: string, is_expression: boolean): string;
export declare function compile_code(code: string, is_expression?: boolean): Compiled | null;
export interface EvalScope {
    /** The state the code reads (local over root). */
    state(): Record<string, unknown>;
    /** The state an EVENT handler writes through (writes reach root state and re-render). */
    writable_state(): Record<string, unknown>;
    globals: Globals;
    context: Record<string, unknown>;
}
export declare function run(fn: Compiled | null, scope: EvalScope, code: string, event?: unknown, writable?: boolean): unknown;
export declare function evaluate(code: string, scope: EvalScope, is_expression?: boolean): unknown;
/**
 * The state proxy an event handler writes through — the official `flattenState`: reads prefer local
 * state, nested objects stay writable, and a write lands in root state and calls `root_set_state`.
 */
export declare function flatten_state(root: Record<string | symbol, unknown>, local: Record<string | symbol, unknown> | undefined, root_set_state: ((next: Record<string, unknown>) => void) | undefined): Record<string, unknown>;
export {};
