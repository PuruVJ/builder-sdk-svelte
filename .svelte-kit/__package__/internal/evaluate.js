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
const cache = new Map();
/** A process-wide bound on distinct code strings (content is finite; a runaway source is not). */
const MAX_CACHED = 5000;
export function parse_code(code, is_expression) {
    const use_return = is_expression && !(code.includes(';') || code.includes(' return ') || code.trim().startsWith('return '));
    return use_return ? `return (${code});` : code;
}
export function compile_code(code, is_expression = true) {
    const key = (is_expression ? 'e' : 's') + code;
    let fn = cache.get(key);
    if (fn !== undefined)
        return fn;
    try {
        fn = new Function('state', 'Builder', 'builder', 'context', 'event', parse_code(code, is_expression));
    }
    catch (e) {
        console.error('[Builder.io]: Failed code evaluation: ' + e.message, { code });
        fn = null;
    }
    if (cache.size >= MAX_CACHED)
        cache.delete(cache.keys().next().value);
    cache.set(key, fn);
    return fn;
}
export function run(fn, scope, code, event, writable = false) {
    if (!fn)
        return undefined;
    try {
        return fn(writable ? scope.writable_state() : scope.state(), scope.globals, scope.globals, scope.context, event);
    }
    catch (e) {
        console.error('[Builder.io]: Failed code evaluation: ' + e.message, { code });
        return undefined;
    }
}
export function evaluate(code, scope, is_expression = true) {
    if (code.trim() === '')
        return undefined;
    return run(compile_code(code, is_expression), scope, code);
}
/**
 * The state proxy an event handler writes through — the official `flattenState`: reads prefer local
 * state, nested objects stay writable, and a write lands in root state and calls `root_set_state`.
 */
export function flatten_state(root, local, root_set_state) {
    return new Proxy(root, {
        get(target, prop) {
            if (local && prop in local)
                return local[prop];
            const val = target[prop];
            if (typeof val === 'object' && val !== null) {
                return flatten_state(val, undefined, root_set_state
                    ? (sub) => {
                        target[prop] = sub;
                        root_set_state(target);
                    }
                    : undefined);
            }
            return val;
        },
        set(target, prop, value) {
            if (local && prop in local)
                throw new Error('Writing to local state is not allowed as it is read-only.');
            target[prop] = value;
            root_set_state?.(target);
            return true;
        }
    });
}
