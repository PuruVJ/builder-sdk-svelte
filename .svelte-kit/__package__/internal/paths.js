/**
 * Path helpers for bindings (`component.options.text`, `responsiveStyles.large.color`).
 *
 * The official SDK deep-clones the WHOLE block subtree (JSON round-trip, children included) before
 * applying bindings, on every one of ~107 calls per block. Here a binding writes through a
 * copy-on-write path: only the objects along the path are copied; everything else is shared.
 */
const PATH_RE = /[^.[\]]+/g;
const path_cache = new Map();
export function parse_path(path) {
    let parts = path_cache.get(path);
    if (!parts) {
        parts = path.match(PATH_RE) ?? [];
        path_cache.set(path, parts);
    }
    return parts;
}
const is_index = (key) => Math.abs(Number(key)) >> 0 === +key;
/**
 * Set `value` at `path` in `root`, copying only the containers on the path (never mutating the
 * input). Returns the new root. Same container rules as the official lodash-style `set`: a missing
 * container becomes an array when the next key is an index, an object otherwise.
 */
export function set_cow(root, path, value, copied) {
    const out = copy_once(root, copied);
    let node = out;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        const next = node[key];
        const child = next !== null && typeof next === 'object'
            ? copy_once(next, copied)
            : is_index(path[i + 1])
                ? []
                : {};
        if (child !== next) {
            copied.add(child);
            node[key] = child;
        }
        node = child;
    }
    node[path[path.length - 1]] = value;
    return out;
}
function copy_once(obj, copied) {
    if (copied.has(obj))
        return obj;
    const copy = Array.isArray(obj) ? obj.slice() : { ...obj };
    copied.add(copy);
    return copy;
}
/** `get(obj, 'a.b.c')`. */
export function get_path(obj, path) {
    let node = obj;
    for (const key of path) {
        if (node == null)
            return undefined;
        node = node[key];
    }
    return node;
}
