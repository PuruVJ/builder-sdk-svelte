/**
 * Path helpers for bindings (`component.options.text`, `responsiveStyles.large.color`).
 *
 * The official SDK deep-clones the WHOLE block subtree (JSON round-trip, children included) before
 * applying bindings, on every one of ~107 calls per block. Here a binding writes through a
 * copy-on-write path: only the objects along the path are copied; everything else is shared.
 */
export declare function parse_path(path: string): string[];
/**
 * Set `value` at `path` in `root`, copying only the containers on the path (never mutating the
 * input). Returns the new root. Same container rules as the official lodash-style `set`: a missing
 * container becomes an array when the next key is an index, an object otherwise.
 */
export declare function set_cow<T extends object>(root: T, path: string[], value: unknown, copied: WeakSet<object>): T;
/** `get(obj, 'a.b.c')`. */
export declare function get_path(obj: unknown, path: string[]): unknown;
