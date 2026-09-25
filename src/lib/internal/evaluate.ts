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

const cache = new Map<string, Compiled | null>();
/** A process-wide bound on distinct code strings (content is finite; a runaway source is not). */
const MAX_CACHED = 5000;

export function parse_code(code: string, is_expression: boolean): string {
	const use_return =
		is_expression && !(code.includes(';') || code.includes(' return ') || code.trim().startsWith('return '));
	return use_return ? `return (${code});` : code;
}

export function compile_code(code: string, is_expression = true): Compiled | null {
	const key = (is_expression ? 'e' : 's') + code;
	let fn = cache.get(key);
	if (fn !== undefined) return fn;
	try {
		fn = new Function('state', 'Builder', 'builder', 'context', 'event', parse_code(code, is_expression)) as Compiled;
	} catch (e) {
		console.error('[Builder.io]: Failed code evaluation: ' + (e as Error).message, { code });
		fn = null;
	}
	if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
	cache.set(key, fn);
	return fn;
}

export interface EvalScope {
	/** The state the code reads (local over root). */
	state(): Record<string, unknown>;
	/** The state an EVENT handler writes through (writes reach root state and re-render). */
	writable_state(): Record<string, unknown>;
	globals: Globals;
	context: Record<string, unknown>;
}

export function run(fn: Compiled | null, scope: EvalScope, code: string, event?: unknown, writable = false): unknown {
	if (!fn) return undefined;
	try {
		return fn(writable ? scope.writable_state() : scope.state(), scope.globals, scope.globals, scope.context, event);
	} catch (e) {
		console.error('[Builder.io]: Failed code evaluation: ' + (e as Error).message, { code });
		return undefined;
	}
}

export function evaluate(code: string, scope: EvalScope, is_expression = true): unknown {
	if (code.trim() === '') return undefined;
	return run(compile_code(code, is_expression), scope, code);
}

/**
 * The state proxy an event handler writes through — the official `flattenState`: reads prefer local
 * state, nested objects stay writable, and a write lands in root state and calls `root_set_state`.
 */
export function flatten_state(
	root: Record<string | symbol, unknown>,
	local: Record<string | symbol, unknown> | undefined,
	root_set_state: ((next: Record<string, unknown>) => void) | undefined
): Record<string, unknown> {
	return new Proxy(root, {
		get(target, prop) {
			if (local && prop in local) return local[prop];
			const val = target[prop];
			if (typeof val === 'object' && val !== null) {
				return flatten_state(
					val as Record<string | symbol, unknown>,
					undefined,
					root_set_state
						? (sub) => {
								target[prop] = sub;
								root_set_state(target as Record<string, unknown>);
							}
						: undefined
				);
			}
			return val;
		},
		set(target, prop, value) {
			if (local && prop in local) throw new Error('Writing to local state is not allowed as it is read-only.');
			target[prop] = value;
			root_set_state?.(target as Record<string, unknown>);
			return true;
		}
	}) as Record<string, unknown>;
}
