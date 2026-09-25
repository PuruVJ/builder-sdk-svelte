import { is_browser } from './env.js';
import { sdk_headers } from './track.js';
const is_positive = (n) => typeof n === 'number' && !isNaN(n) && n >= 0;
function flatten(obj, path = null, out = {}) {
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const p = path ? path + '.' + key : key;
        if (typeof value === 'object' && value !== null && !(Array.isArray(value) && value.length === 0))
            flatten(value, p, out);
        else
            out[p] = value;
    }
    return out;
}
function flatten_mongo(obj, current, out = {}) {
    for (const key in obj) {
        const value = obj[key];
        const k = current ? current + '.' + key : key;
        if (value && typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).find((i) => i.startsWith('$')))
            flatten_mongo(value, k, out);
        else
            out[k] = value;
    }
    return out;
}
function unflatten(obj) {
    const result = {};
    for (const key in obj) {
        const parts = key.split('.');
        let cur = result;
        for (let i = 0; i < parts.length; i++) {
            if (i === parts.length - 1)
                cur[parts[i]] = obj[key];
            else
                cur = cur[parts[i]] = cur[parts[i]] || {};
        }
    }
    return result;
}
const to_object = (s) => {
    if (!(s instanceof URLSearchParams))
        return s;
    const out = {};
    s.forEach((v, k) => (out[k] = v));
    return out;
};
/** official `getBuilderSearchParams`: the `builder.*` params, prefix stripped. */
export function builder_search_params(input) {
    if (!input)
        return {};
    const options = to_object(input);
    const out = {};
    for (const key of Object.keys(options)) {
        if (key.startsWith('builder.'))
            out[key.replace('builder.', '').replace('options.', '')] = options[key];
    }
    return out;
}
export function content_url(options) {
    const { limit = 30, userAttributes, query, model, apiKey, enrich, locale, apiVersion = 'v3', fields, omit, offset, cacheSeconds, staleCacheSeconds, sort, includeUnpublished, apiHost } = options;
    if (!apiKey)
        throw new Error('Missing API key');
    if (apiVersion !== 'v3')
        throw new Error(`Invalid apiVersion: expected 'v3', received '${apiVersion}'`);
    const url = new URL(`${apiHost || 'https://cdn.builder.io'}/api/${apiVersion}/content/${model}`);
    const sp = url.searchParams;
    sp.set('apiKey', apiKey);
    sp.set('limit', String(limit));
    sp.set('noTraverse', String(limit !== 1));
    sp.set('includeRefs', 'true');
    if (locale)
        sp.set('locale', locale);
    if (enrich)
        sp.set('enrich', String(enrich));
    sp.set('omit', omit ?? 'meta.componentsUsed');
    if (fields)
        sp.set('fields', fields);
    if (Number.isFinite(offset) && offset > -1)
        sp.set('offset', String(Math.floor(offset)));
    if (typeof includeUnpublished === 'boolean')
        sp.set('includeUnpublished', String(includeUnpublished));
    if (cacheSeconds && is_positive(cacheSeconds))
        sp.set('cacheSeconds', String(cacheSeconds));
    if (staleCacheSeconds && is_positive(staleCacheSeconds))
        sp.set('staleCacheSeconds', String(staleCacheSeconds));
    if (sort) {
        const flat = flatten({ sort });
        for (const key in flat)
            sp.set(key, JSON.stringify(flat[key]));
    }
    const query_options = {
        ...(is_browser() ? builder_search_params(new URLSearchParams(window.location.search)) : {}),
        ...to_object(options.options || {})
    };
    let final_attrs = { ...(userAttributes || {}) };
    if (is_browser() && query_options.preview === 'BUILDER_STUDIO') {
        query_options['userAttributes.urlPath'] = window.location.pathname;
        query_options['userAttributes.host'] = window.location.host;
        const picked = {};
        for (const key in query_options) {
            if (key.startsWith('userAttributes.')) {
                picked[key] = query_options[key];
                delete query_options[key];
            }
        }
        final_attrs = { ...final_attrs, ...unflatten(picked).userAttributes };
    }
    const flat = flatten(query_options);
    for (const key in flat)
        sp.set(key, String(flat[key]));
    if (Object.keys(final_attrs).length > 0)
        sp.set('userAttributes', JSON.stringify(final_attrs));
    if (query) {
        const flatq = flatten_mongo({ query });
        for (const key in flatq)
            sp.set(key, JSON.stringify(flatq[key]));
    }
    return url;
}
export async function fetch_entries(options) {
    const url = content_url(options);
    const f = options.fetch ?? fetch;
    const res = await f(url.href, {
        ...options.fetchOptions,
        headers: { ...options.fetchOptions?.headers, ...sdk_headers() }
    });
    const content = (await res.json());
    if (!content || !('results' in content)) {
        console.error('[Builder.io]: Error fetching data. ', { url, content, options });
        throw content;
    }
    return content.results;
}
export async function fetch_one_entry(options) {
    const locale = options.locale || options.userAttributes?.locale;
    if (locale) {
        options.locale = locale;
        options.userAttributes = { locale, ...options.userAttributes };
    }
    const all = await fetch_entries({ ...options, limit: 1 });
    return all?.[0] || null;
}
