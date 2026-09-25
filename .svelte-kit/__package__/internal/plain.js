/** Off only in tests: the markup-parity test renders every page both ways and compares bytes. */
export const PLAIN = { on: true };
/** Built-in components whose whole output is a pure function of the compiled block (no state). */
export const PLAIN_COMPONENTS = new WeakMap();
// ── Svelte's SSR attribute rules (svelte/src/internal/server `attributes` + shared `attr`) ──────
const ATTR_ESCAPE_RE = /[&"<]/g;
const INVALID_ATTR_NAME_RE = /[\s'">/=\u{FDD0}-\u{FDEF}\u{FFFE}\u{FFFF}\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/u;
/** A tag the string path handles (anything else — custom namespaces, odd names — stays a <Block>). */
const SIMPLE_TAG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const BOOLEAN_ATTRIBUTES = new Set([
    'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'disabled',
    'formnovalidate', 'indeterminate', 'inert', 'ismap', 'loop', 'multiple', 'muted', 'nomodule',
    'novalidate', 'open', 'playsinline', 'readonly', 'required', 'reversed', 'seamless', 'selected',
    'webkitdirectory', 'defer', 'disablepictureinpicture', 'disableremoteplayback'
]);
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
/** Tags never on the string path: special SSR rules (form values, raw text), and SVG/MathML (a
 *  string mounted in the browser outside its namespace would come out as HTML elements). */
const SPECIAL_TAGS = new Set([
    'input', 'textarea', 'select', 'option', 'script', 'style', 'template', 'title', 'noscript', 'iframe',
    'xmp', 'plaintext', 'noembed', 'noframes', 'svg', 'math', 'path', 'g', 'circle', 'rect', 'line',
    'polyline', 'polygon', 'ellipse', 'text', 'tspan', 'textpath', 'defs', 'use', 'symbol', 'clippath',
    'lineargradient', 'radialgradient', 'stop', 'mask', 'pattern', 'image', 'foreignobject', 'filter',
    'marker', 'desc', 'metadata', 'switch', 'view', 'animate', 'animatetransform', 'animatemotion', 'set',
    'mi', 'mo', 'mn', 'ms', 'mtext', 'mrow', 'mfrac', 'msqrt', 'mroot', 'msub', 'msup', 'msubsup'
]);
function escape_attr(value) {
    const str = String(value ?? '');
    ATTR_ESCAPE_RE.lastIndex = 0;
    if (!ATTR_ESCAPE_RE.test(str))
        return str;
    ATTR_ESCAPE_RE.lastIndex = 0;
    let out = '';
    let last = 0;
    while (ATTR_ESCAPE_RE.test(str)) {
        const i = ATTR_ESCAPE_RE.lastIndex - 1;
        const ch = str[i];
        out += str.substring(last, i) + (ch === '&' ? '&amp;' : ch === '"' ? '&quot;' : '&lt;');
        last = i + 1;
    }
    return out + str.substring(last);
}
/** A spread `{...attrs}` on an HTML element, as Svelte's server renders it. */
export function attrs_html(attrs) {
    let out = '';
    for (const key of Object.keys(attrs)) {
        let value = attrs[key];
        if (typeof value === 'function')
            continue;
        if (key[0] === '$' && key[1] === '$')
            continue;
        if (key === '' || INVALID_ATTR_NAME_RE.test(key))
            continue;
        const name = key.toLowerCase();
        if (name.length > 2 && name.startsWith('on'))
            continue;
        const boolean = BOOLEAN_ATTRIBUTES.has(name) || (name === 'hidden' && value !== 'until-found');
        if (value == null || (boolean && !value && value !== ''))
            continue;
        if (name === 'translate' && (value === true || value === false))
            value = value ? 'yes' : 'no';
        out += boolean ? ` ${name}=""` : ` ${name}="${escape_attr(value)}"`;
    }
    return out;
}
// ── plainness + the string, per compiled block ──────────────────────────────────────────────────
const NONE = 0; // has behaviour: a live <Block>
const EMPTY = 1; // renders nothing (hidden; noWrap entry without a component)
const LEAF = 2; // wrapper + a plain component's markup (children not rendered)
const VOID = 3; // a void element
const WRAP = 4; // wrapper + its children (no component, or an entry registered without one)
function kind_of(c, plan) {
    if (c.bindings || c.repeat || c.actions || c.text_tpl)
        return NONE;
    if (c.src.animations?.length)
        return NONE;
    if (!c.visible)
        return EMPTY;
    if (c.css && !plan.in_sheet.has(c.src))
        return NONE;
    const component = c.comp?.component;
    if (c.no_wrap)
        return component ? NONE : EMPTY;
    if (!SIMPLE_TAG_RE.test(c.tag) || SPECIAL_TAGS.has(c.tag))
        return NONE;
    if (component) {
        if (!PLAIN_COMPONENTS.has(component))
            return NONE;
        if (c.empty_tag)
            return VOID;
        return LEAF;
    }
    return c.empty_tag ? VOID : WRAP;
}
/**
 * The plain HTML of `root`'s subtree, or null when something in it has behaviour. Computed once per
 * block per plan (cached on the compiled record, with every plain subtree met on the way).
 */
export function plain_html(plan, root) {
    if (!PLAIN.on)
        return null;
    if (root.html !== undefined)
        return root.html;
    // Pre-order walk with an explicit stack; then fill in REVERSE pre-order, so every child's string
    // exists before its parent's. No recursion at any depth.
    const order = [];
    const kinds = [];
    const stack = [root];
    while (stack.length) {
        const c = stack.pop();
        if (c.html !== undefined)
            continue;
        const kind = kind_of(c, plan);
        order.push(c);
        kinds.push(kind);
        if (kind === WRAP)
            for (let i = c.children.length - 1; i >= 0; i--)
                stack.push(plan.compile(c.children[i]));
    }
    for (let i = order.length - 1; i >= 0; i--) {
        const c = order[i];
        const kind = kinds[i];
        let links = c.is_link;
        let html;
        if (kind === NONE)
            html = null;
        else if (kind === EMPTY)
            html = '';
        else {
            const open = `<${c.tag}${attrs_html(c.attrs)}>`;
            if (kind === VOID)
                html = open;
            else if (kind === LEAF)
                html = open + PLAIN_COMPONENTS.get(c.comp.component)(c) + `</${c.tag}>`;
            else {
                html = open;
                for (const child of c.children) {
                    const cc = plan.compile(child);
                    if (cc.html == null) {
                        html = null;
                        break;
                    }
                    // A live <Block> emits one space before its content (the whitespace text node in
                    // Block.svelte's template, hidden blocks too): kept, so inline layout is identical.
                    html += ' ' + cc.html;
                    if (cc.links)
                        links = true;
                }
                if (html !== null)
                    html += `</${c.tag}>`;
            }
        }
        c.html = html;
        c.links = links;
    }
    return root.html;
}
