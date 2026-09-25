/**
 * Form block helpers (official blocks/form/form + functions/get, set, get-env, log-fetch).
 * Every regex is hoisted; the path split reuses the cached parser the bindings use.
 */
import { parse_path } from '../internal/paths.js';
/** official `get`'s split: `a.b[0].c` → ['a', 'b', '0', 'c']. */
const GET_SPLIT_RE = /[,[\].]+?/;
/** official `get(obj, path, defaultValue)`. */
export function get_at(obj, path, default_value) {
    const keys = String.prototype.split.call(path, GET_SPLIT_RE);
    let res = obj;
    for (const key of keys) {
        if (!key)
            continue;
        res = res !== null && res !== undefined ? res[key] : res;
    }
    return res === undefined || res === obj ? default_value : res;
}
/** official lodash-style `set(obj, path, value)`: missing containers become arrays before an index. */
export function set_at(obj, path, value) {
    const keys = parse_path(path);
    if (!keys.length)
        return;
    let node = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        const next = node[key];
        if (Object(next) === next)
            node = next;
        else {
            const child = Math.abs(Number(keys[i + 1])) >> 0 === +keys[i + 1] ? [] : {};
            node[key] = child;
            node = child;
        }
    }
    node[keys[keys.length - 1]] = value;
}
/** The named fields of a form and their typed values (official `formPairs`). */
export function form_pairs(form) {
    const out = [];
    const fields = form.querySelectorAll('input,select,textarea');
    for (let i = 0; i < fields.length; i++) {
        const el = fields[i];
        const key = el.name;
        if (!key)
            continue;
        let value;
        if (el instanceof HTMLInputElement) {
            const type = el.type;
            if (type === 'radio') {
                if (!el.checked)
                    continue;
                value = el.value;
            }
            else if (type === 'checkbox')
                value = el.checked;
            else if (type === 'number' || type === 'range') {
                const num = el.valueAsNumber;
                if (!isNaN(num))
                    value = num;
            }
            else if (type === 'file')
                value = el.files ?? undefined;
            else
                value = el.value;
        }
        else
            value = el.value;
        out.push({ key, value });
    }
    return out;
}
/** official `getEnv() === 'dev'` (NODE_ENV literally `dev`). */
const is_dev_env = () => typeof process !== 'undefined' && process.env?.NODE_ENV === 'dev';
/** The Builder form-submit endpoint for `sendSubmissionsTo: 'email'`. */
export function email_submit_url(api_key, email, name) {
    return `${is_dev_env() ? 'http://localhost:5000' : 'https://builder.io'}/api/v1/form-submit?apiKey=${api_key}&to=${btoa(email || '')}&name=${encodeURIComponent(name || '')}`;
}
/** official `logFetch`. */
export function log_fetch(url) {
    if (typeof process !== 'undefined' && process.env?.DEBUG && String(process.env.DEBUG) == 'true') {
        console.log('[Builder.io]: ', url);
    }
}
