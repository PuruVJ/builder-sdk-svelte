export const REGISTRY_BRAND = Symbol.for('puruvj.builder.registry');
const by_list = new WeakMap();
let default_list = [];
/** Set by the package entry (defaults import the built-in block components). */
export function set_default_components(list) {
    default_list = list;
    by_list_empty = null;
}
let by_list_empty = null;
export function registry_for(custom) {
    if (custom && custom[REGISTRY_BRAND])
        return custom;
    if (!custom)
        return (by_list_empty ??= build([]));
    let reg = by_list.get(custom);
    if (!reg) {
        // An array (the `customComponents` prop) or a name→component object (`builderComponents`,
        // handed back to <Blocks registeredComponents>): both describe the full set of components.
        const list = Array.isArray(custom) ? custom : Object.values(custom);
        reg = Array.isArray(custom) ? build(list) : build_exact(list);
        by_list.set(custom, reg);
    }
    return reg;
}
function build(custom) {
    return build_exact([...default_list, ...custom]);
}
function build_exact(list) {
    const by_name = new Map();
    for (const entry of list)
        if (entry?.name)
            by_name.set(entry.name, entry);
    const objects = new Map();
    return {
        [REGISTRY_BRAND]: true,
        by_name,
        as_object(model) {
            let obj = objects.get(model);
            if (!obj) {
                obj = {};
                for (const [name, entry] of by_name)
                    if (!is_restricted(entry, model))
                        obj[name] = entry;
                // Brand it so <Blocks registeredComponents={builderComponents}> maps straight back here.
                Object.defineProperty(obj, REGISTRY_BRAND, { value: true });
                Object.defineProperty(obj, 'by_name', { value: by_name });
                Object.defineProperty(obj, 'as_object', { value: this.as_object });
                objects.set(model, obj);
            }
            return obj;
        }
    };
}
export function is_restricted(entry, model) {
    if (!entry)
        return true;
    if (!model)
        return false;
    return !!entry.models && entry.models.length > 0 && !entry.models.includes(model);
}
const warned = new Set();
/** The component a block names, or `undefined` (warned once per name, not once per call). */
export function lookup(registry, name, model) {
    const entry = registry.by_name.get(name);
    if (!entry || is_restricted(entry, model)) {
        if (!warned.has(name)) {
            warned.add(name);
            console.warn(`
      Could not find a registered component named "${name}".
      If you registered it, is the file that registered it imported by the file that needs to render it?`);
        }
        return undefined;
    }
    return entry;
}
