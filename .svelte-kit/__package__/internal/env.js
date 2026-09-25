/** Environment checks — the official semantics (functions/is-*.ts). */
export const is_browser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
export const is_iframe = () => is_browser() && window.self !== window.top;
export function search_string(search) {
    if (typeof search === 'string')
        return search;
    if (search instanceof URLSearchParams)
        return search.toString();
    return new URLSearchParams(search).toString();
}
export function is_editing(search) {
    return is_iframe() && search_string(search || window.location.search).indexOf('builder.frameEditing=') !== -1;
}
export function is_previewing(search) {
    const s = search || (is_browser() ? window.location.search : undefined);
    if (!s)
        return false;
    return search_string(s).indexOf('builder.preview=') !== -1;
}
