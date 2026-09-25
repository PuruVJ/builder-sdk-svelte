/**
 * The `attributes` a noWrap block receives carry its wrapper attributes plus `on:<event>` handlers
 * (official `filterAttrs` + the `setAttrs` action). Svelte 5 attaches handlers from a spread, so they
 * are mapped to `on<event>` props instead of an action.
 */
export function plain_attrs(attrs) {
    const out = {};
    if (!attrs)
        return out;
    for (const key in attrs) {
        const v = attrs[key];
        if (!v || key.startsWith('on:'))
            continue; // official filterAttrs drops falsy values
        out[key] = v;
    }
    return out;
}
export function event_attrs(attrs) {
    const out = {};
    if (!attrs)
        return out;
    for (const key in attrs) {
        if (!key.startsWith('on:') || !attrs[key])
            continue;
        out['on' + key.slice(3)] = attrs[key];
    }
    return out;
}
/** Both at once, for the common spread. */
export function all_attrs(attrs) {
    const out = {};
    if (!attrs)
        return out;
    for (const key in attrs) {
        const v = attrs[key];
        if (!v)
            continue;
        if (key.startsWith('on:'))
            out['on' + key.slice(3)] = v;
        else
            out[key] = v;
    }
    return out;
}
