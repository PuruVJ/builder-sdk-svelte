/**
 * Localized values (`{ '@type': '@builder.io/core:LocalizedValue', 'en-US': …, Default: … }`).
 *
 * The official SDK walks a block's whole `component.options` (nested child blocks included) on
 * EVERY `getProcessedBlock` call — ~107 times per block per render, the single largest SSR cost it
 * has. Here each block's options are resolved once, when the block is compiled, and the result is
 * cached with it. The input is never mutated.
 */
const LOCALIZED_TYPE = '@builder.io/core:LocalizedValue';
const ELEMENT_TYPE = '@builder.io/sdk:Element';
let warned_missing_locale = false;
/** `options` with every localized value replaced by its `locale` entry (a copy only where one was). */
export function resolve_localized(options, locale) {
    if (!options)
        return options;
    const out = walk(options, locale ?? 'Default');
    if (out !== options && !locale && !warned_missing_locale) {
        warned_missing_locale = true;
        console.warn('[Builder.io] In order to use localized fields in Builder, you must pass a locale prop to the BuilderComponent or to options object while fetching the content to resolve localized fields. Learn more: https://www.builder.io/c/docs/localization-inline#targeting-and-inline-localization');
    }
    return out;
}
function walk(value, locale) {
    if (value === null || typeof value !== 'object')
        return value;
    const obj = value;
    if (obj['@type'] === LOCALIZED_TYPE)
        return obj[locale] ?? undefined;
    // A nested block is compiled (and localized) on its own — its options are not this block's.
    // The official walk descends into nested blocks too; the value each of them ends up rendering
    // is the same either way, because every block resolves its own options.
    if (obj['@type'] === ELEMENT_TYPE)
        return value;
    if (Array.isArray(value)) {
        let out = null;
        for (let i = 0; i < value.length; i++) {
            const next = walk(value[i], locale);
            if (next !== value[i])
                (out ??= value.slice())[i] = next;
        }
        return out ?? value;
    }
    let out = null;
    for (const key in obj) {
        const cur = obj[key];
        const next = walk(cur, locale);
        if (next !== cur)
            (out ??= { ...obj })[key] = next;
    }
    return out ?? value;
}
