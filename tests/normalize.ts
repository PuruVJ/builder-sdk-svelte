/**
 * Normalise SSR output so the two SDKs can be compared for what the browser gets, not for how the
 * bytes are arranged:
 *  - hydration comments (`<!--[-->`, `<!---->`) and whitespace-only text are dropped;
 *  - `<style>` elements are pulled out: their CSS is compared separately as a SET of top-level
 *    rules (the official SDK emits one <style> per block, repeats included; ours one sheet);
 *  - `class`: token set, Svelte scope hashes (`svelte-xxxx`) dropped;
 *  - `style`: declarations trimmed; empty `style` = absent;
 *  - the official content wrapper's invalid `style="display:undefined;"` is ignored.
 */
import { parse, parseFragment, serialize } from 'parse5';

type Node = {
	nodeName: string;
	tagName?: string;
	attrs?: Array<{ name: string; value: string }>;
	childNodes?: Node[];
	value?: string;
	data?: string;
	content?: Node;
};

const SVELTE_HASH_RE = /^svelte-[a-z0-9]+$/;
const WS_RE = /\s+/g;
const DECL_SPLIT_RE = /;\s*/;

export interface Normalized {
	tree: string;
	css: string[];
}

export function normalize(html: string): Normalized {
	const doc = parseFragment(html) as unknown as Node;
	const css: string[] = [];
	const lines: string[] = [];
	walk(doc, 0, lines, css);
	return { tree: lines.join('\n'), css: [...new Set(css.flatMap(split_rules))].sort() };
}

function walk(node: Node, depth: number, out: string[], css: string[]): void {
	for (const child of node.childNodes ?? []) {
		if (child.nodeName === '#comment') continue;
		if (child.nodeName === '#text') {
			const t = (child.value ?? '').replace(WS_RE, ' ').trim();
			if (t) out.push('  '.repeat(depth) + '"' + t + '"');
			continue;
		}
		// The official SDK puts its A/B + personalization helper functions (~9.5 KB) on EVERY top-level
		// content; ours only where content uses them. Those features are covered by the official e2e
		// suite (ab-test, personalization-container), not by this DOM comparison.
		if (child.nodeName === 'script' && (child.attrs ?? []).some((a) => a.name === 'data-id' && a.value.startsWith('builderio-init-'))) continue;
		if (child.nodeName === 'style') {
			css.push((child.childNodes ?? []).map((c) => c.value ?? '').join(''));
			continue;
		}
		const attrs = (child.attrs ?? [])
			.map((a) => norm_attr(a.name, a.value))
			.filter((a): a is string => a !== null)
			.sort();
		out.push('  '.repeat(depth) + '<' + child.nodeName + (attrs.length ? ' ' + attrs.join(' ') : '') + '>');
		walk(child.nodeName === 'template' && child.content ? child.content : child, depth + 1, out, css);
	}
}

function norm_attr(name: string, value: string): string | null {
	if (name === 'class') {
		const tokens = value.split(WS_RE).filter((t) => t && !SVELTE_HASH_RE.test(t)).sort();
		return tokens.length ? `class="${tokens.join(' ')}"` : null;
	}
	if (name === 'style') {
		const decls = value
			.split(DECL_SPLIT_RE)
			.map((d) => d.trim().replace(WS_RE, ' '))
			.filter((d) => d && d !== 'display:undefined');
		return decls.length ? `style="${decls.join(';')}"` : null;
	}
	return `${name}="${value}"`;
}

/** Top-level CSS rules of a sheet, whitespace-normalised (a `@media {…}` block is one rule). */
export function split_rules(sheet: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < sheet.length; i++) {
		const ch = sheet[i];
		if (ch === '{') depth++;
		else if (ch === '}') {
			depth--;
			if (depth === 0) {
				const rule = norm_css(sheet.slice(start, i + 1));
				if (rule) out.push(rule);
				start = i + 1;
			}
		}
	}
	return out;
}

const CSS_PUNCT_RE = /\s*([{};:,])\s*/g;
const LEADING_COMMA_RE = /^,/;

function norm_css(rule: string): string {
	return rule.replace(WS_RE, ' ').replace(CSS_PUNCT_RE, '$1').trim().replace(LEADING_COMMA_RE, '');
}

export { parse, serialize };
