import { plan_for } from './compile.js';
import { evaluate } from './evaluate.js';
import { is_browser, is_editing } from './env.js';
import { registry_for } from './registry.js';
import { Scope } from './scope.js';
import { get_user_attributes, track } from './track.js';
/** official `getContentInitialValue`: the content with `data` merged into `content.data`. */
export function merged_content(content, data) {
    if (!content)
        return undefined;
    if (!data)
        return content;
    return { ...content, data: { ...content.data, ...data }, meta: content.meta };
}
/** official `getRootStateInitialValue` */
export function initial_root_state(content, data, locale) {
    const defaults = {};
    for (const input of content?.data?.inputs ?? []) {
        if (input.name && input.defaultValue !== undefined)
            defaults[input.name] = input.defaultValue;
    }
    return { ...defaults, ...(content?.data?.state ?? {}), ...data, ...(locale ? { locale } : {}) };
}
/**
 * The plan a content renders from. Keyed by the content OBJECT the app passed: the same object
 * rendered again (an app that caches its fetch) reuses every compiled block; a fresh object compiles
 * once. (When `data` carries its own `blocks`, those are what render: key by that array instead.)
 */
export function plan_of(input) {
    const content = merged_content(input.content, input.data);
    const blocks = content?.data?.blocks;
    const key = input.data?.blocks ? blocks : (input.content ?? EMPTY);
    return plan_for(key, {
        registry: registry_for(input.customComponents),
        model: input.model,
        locale: input.locale,
        breakpoints: content?.meta?.breakpoints
    }, blocks);
}
export function create_content(input, version, bump) {
    const content = merged_content(input.content, input.data);
    const plan = plan_of(input);
    const registry = plan.registry;
    let root = initial_root_state(input.content, input.data, input.locale);
    let initializing = true;
    const tracking = {
        apiKey: input.apiKey ?? null,
        canTrack: input.canTrack ?? true,
        contentId: content?.id,
        variationId: content?.testVariationId
    };
    const globals = {
        isEditing: is_editing(),
        isBrowser: is_browser(),
        isServer: !is_browser(),
        getUserAttributes: () => get_user_attributes(),
        trackConversion: (amount, customProperties) => {
            if (!tracking.apiKey || tracking.canTrack === false)
                return;
            void track({
                type: 'conversion',
                apiKey: tracking.apiKey,
                canTrack: tracking.canTrack,
                contentId: tracking.contentId,
                variationId: tracking.variationId !== tracking.contentId ? tracking.variationId : undefined,
                metadata: { ...(customProperties || {}), ...(amount !== undefined ? { amount } : {}) },
                apiHost: input.apiHost
            });
        }
    };
    const ctx = {
        plan,
        registry,
        model: input.model,
        content,
        get root() {
            return root;
        },
        set root(v) {
            root = v;
        },
        context: input.context ?? {},
        globals,
        api_key: input.apiKey,
        api_version: input.apiVersion,
        api_host: input.apiHost,
        can_track: input.canTrack,
        nonce: input.nonce ?? '',
        link_component: input.linkComponent,
        blocks_wrapper: input.blocksWrapper ?? 'div',
        blocks_wrapper_props: input.blocksWrapperProps ?? {},
        version,
        bump,
        root_set_state(next) {
            root = next;
            // A write while this content is being set up (jsCode) is read by the first render; only a
            // later write (an action, a fetch) needs a re-render.
            if (!initializing)
                bump();
        }
    };
    const scope = new Scope(ctx);
    // official Content: run the content's dynamic JS (on both legs, like the official SDK).
    // Writes it makes land in root state; the render that follows reads them (no re-render needed).
    const js = content?.data?.jsCode;
    if (js) {
        const writable = () => scope.writable_state();
        evaluate(js, { state: writable, writable_state: writable, globals, context: ctx.context }, false);
    }
    initializing = false;
    return { ctx, scope };
}
const EMPTY = {};
