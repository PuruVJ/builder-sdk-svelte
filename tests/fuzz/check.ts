/**
 * One fuzz check: render a spec through both SDKs (the way tests/equivalence.test.ts does) and
 * through ours with PLAIN on and off (tests/plain.test.ts), and say what, if anything, differs.
 * Plus a delta-debugging shrinker that keeps a failure while making its content smaller.
 */
import { normalize } from '../normalize.js';
import type { Json, Spec } from './gen.js';
// @ts-ignore built by `pnpm bench:build`
import { components_for, render_content, set_plain } from '../../bench/dist/entry.js';

const ELEMENT = '@builder.io/sdk:Element';
const BUILDER_ID_RE = /builder-id="([^"]+)"/g;
const CLASS_ID_RE = /\.(builder-[a-z0-9-]+?)(?=[\s{:.>,]|-breakpoints)/g;
const COMMENT_RE = /<!--[^]*?-->/g;
const ANCHOR_OPEN_RE = /<a(?=[\s>])/g;
const ANCHOR_CLOSE_RE = /<\/a>/g;

export const NESTED_LINKS =
	'a link nested in a link: invalid HTML, which the parser repairs around whitespace text; the SDKs place whitespace differently (same tree as written)';

export type Kind = 'ours-throws' | 'tree' | 'css-missing' | 'css-extra' | 'plain' | 'plain-throws';
export interface Failure {
	kind: Kind;
	detail: string;
}
export interface Result {
	failure: Failure | null;
	/** The official render threw (nothing to compare against): its message. */
	official_error?: string;
	/** ...and ours on the same spec (it may throw too, or render). */
	ours_error?: string;
	/** Passed only modulo a known difference (tests/fuzz/known.ts): which. */
	note?: string;
}

/** Anchors renamed, so the parser keeps the tree as written: no "adoption agency" repair of a link
 *  nested in a link (invalid HTML, which a block with href inside another one produces). */
function unanchor(html: string): string {
	return html.replace(ANCHOR_OPEN_RE, '<x-a').replace(ANCHOR_CLOSE_RE, '</x-a>');
}

export function names_in(v: unknown): string[] {
	const names = new Set<string>();
	const stack: unknown[] = [v];
	while (stack.length) {
		const x = stack.pop();
		if (!x || typeof x !== 'object') continue;
		const o = x as Record<string, any>;
		if (o['@type'] === ELEMENT && typeof o.component?.name === 'string' && o.component.name) names.add(o.component.name);
		for (const k in o) stack.push(o[k]);
	}
	return [...names].sort();
}

function render(sdk: 'official' | 'ours', spec: Spec): string {
	const comps = components_for(names_in(spec));
	return render_content(sdk, {
		content: JSON.parse(JSON.stringify(spec.content)),
		model: 'page',
		apiKey: 'test-key',
		customComponents: comps[sdk],
		canTrack: false,
		data: spec.data ? JSON.parse(JSON.stringify(spec.data)) : undefined,
		locale: spec.locale,
		...(spec.props ? JSON.parse(JSON.stringify(spec.props)) : {})
	}).body;
}

/** The first differing line of two normalised trees, with a little context. */
export function first_diff(a: string, b: string): string {
	const la = a.split('\n');
	const lb = b.split('\n');
	let i = 0;
	while (i < la.length && i < lb.length && la[i] === lb[i]) i++;
	const ctx = (l: string[]) => l.slice(Math.max(0, i - 2), i + 3).join('\n');
	return `line ${i}\n--- official\n${ctx(la)}\n--- ours\n${ctx(lb)}`;
}

export function check(spec: Spec): Result {
	let official_html: string;
	try {
		official_html = render('official', spec);
	} catch (e) {
		// No reference to compare against: recorded, not failed (ours may throw too, or render).
		let ours_error: string | undefined;
		try {
			render('ours', spec);
		} catch (e2) {
			ours_error = String((e2 as Error)?.message ?? e2).split('\n')[0];
		}
		return { failure: null, official_error: String((e as Error)?.message ?? e).split('\n')[0], ours_error };
	}
	let ours_html: string;
	try {
		set_plain(true);
		ours_html = render('ours', spec);
	} catch (e) {
		return { failure: { kind: 'ours-throws', detail: String((e as Error)?.stack ?? e).split('\n').slice(0, 6).join('\n') } };
	}
	const official = normalize(official_html);
	const ours = normalize(ours_html);
	let note: string | undefined;
	if (ours.tree !== official.tree) {
		// A link inside a link: the parser closes and re-opens the outer <a> around every text node it
		// meets, whitespace included, and the SDKs place whitespace text differently. Compared as
		// written (anchors renamed), the trees must match.
		if (normalize(unanchor(ours_html)).tree !== normalize(unanchor(official_html)).tree)
			return { failure: { kind: 'tree', detail: first_diff(official.tree, ours.tree) } };
		note = NESTED_LINKS;
	}
	const missing = official.css.filter((r) => !ours.css.includes(r));
	if (missing.length) return { failure: { kind: 'css-missing', detail: missing.slice(0, 3).join('\n') } };
	const rendered_ids = new Set([...ours.tree.matchAll(BUILDER_ID_RE)].map((m) => m[1]));
	const extra = ours.css
		.filter((r) => !official.css.includes(r))
		.filter((r) => [...r.matchAll(CLASS_ID_RE)].some((m) => rendered_ids.has(m[1])));
	if (extra.length) return { failure: { kind: 'css-extra', detail: extra.slice(0, 3).join('\n') } };

	let live: string;
	try {
		set_plain(false);
		live = render('ours', spec);
	} catch (e) {
		return { failure: { kind: 'plain-throws', detail: String((e as Error)?.stack ?? e).split('\n').slice(0, 6).join('\n') } };
	} finally {
		set_plain(true);
	}
	const a = ours_html.replace(COMMENT_RE, '');
	const b = live.replace(COMMENT_RE, '');
	if (a !== b) {
		let i = 0;
		while (i < a.length && a[i] === b[i]) i++;
		return { failure: { kind: 'plain', detail: `at ${i}\n--- plain on\n${a.slice(Math.max(0, i - 120), i + 120)}\n--- plain off\n${b.slice(Math.max(0, i - 120), i + 120)}` } };
	}
	return { failure: null, note };
}

// ── shrinking ───────────────────────────────────────────────────────────────────────────────────
type Path = Array<string | number>;

function get(root: any, path: Path): any {
	let v = root;
	for (const k of path) v = v?.[k];
	return v;
}

/** Every container path in the value, parents before children. */
function paths_of(root: unknown): Path[] {
	const out: Path[] = [];
	const stack: Array<[unknown, Path]> = [[root, []]];
	while (stack.length) {
		const [v, p] = stack.pop()!;
		if (!v || typeof v !== 'object') continue;
		out.push(p);
		const keys = Array.isArray(v) ? v.map((_, i) => i) : Object.keys(v);
		for (let i = keys.length - 1; i >= 0; i--) stack.push([(v as any)[keys[i]], [...p, keys[i]]]);
	}
	return out;
}

/** Candidate smaller versions of `spec` (each a fresh clone with one edit). */
function* candidates(spec: Spec): Generator<Spec> {
	const paths = paths_of(spec);
	// 1. drop chunks of arrays (halves first), then single items
	for (const p of paths) {
		const arr = get(spec, p);
		if (!Array.isArray(arr) || arr.length === 0) continue;
		for (let size = Math.ceil(arr.length / 2); size >= 1; size = size === 1 ? 0 : Math.ceil(size / 2)) {
			for (let start = 0; start < arr.length; start += size) {
				const next = structuredClone(spec);
				get(next, p).splice(start, size);
				yield next;
			}
		}
	}
	// 2. hoist: replace a block with its children / one of its nested block lists' items
	for (const p of paths) {
		const v = get(spec, p);
		if (!v || typeof v !== 'object' || v['@type'] !== ELEMENT || p.length === 0) continue;
		const parent_path = p.slice(0, -1);
		const parent = get(spec, parent_path);
		if (!Array.isArray(parent)) continue;
		for (const kp of paths_of(v)) {
			const kids = get(v, kp);
			if (!Array.isArray(kids) || !kids.length || kids[0]?.['@type'] !== ELEMENT) continue;
			const next = structuredClone(spec);
			get(next, parent_path).splice(p[p.length - 1] as number, 1, ...structuredClone(kids));
			yield next;
		}
	}
	// 3. delete object keys
	for (const p of paths) {
		const obj = get(spec, p);
		if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
		for (const key of Object.keys(obj)) {
			if (p.length === 0 && key === 'content') continue;
			if (key === '@type') continue;
			const next = structuredClone(spec);
			delete get(next, p)[key];
			yield next;
		}
	}
	// 4. simplify scalars: long strings → short
	for (const p of paths) {
		const obj = get(spec, p);
		for (const key of Array.isArray(obj) ? obj.map((_: unknown, i: number) => i) : Object.keys(obj)) {
			const s = obj[key];
			if (typeof s === 'string' && s.length > 1 && key !== '@type' && key !== 'id') {
				const next = structuredClone(spec);
				get(next, p)[key] = 'x';
				yield next;
			}
		}
	}
}

/** Delta debugging: keep applying the first edit that still fails the same way, to a fixpoint. */
export function shrink(spec: Spec, still_fails: (s: Spec) => boolean, max_tries = 4000): Spec {
	let best = spec;
	let tries = 0;
	let progress = true;
	while (progress && tries < max_tries) {
		progress = false;
		for (const next of candidates(best)) {
			if (++tries > max_tries) break;
			let fails = false;
			try {
				fails = still_fails(next);
			} catch {
				fails = false;
			}
			if (fails) {
				best = next;
				progress = true;
				break;
			}
		}
	}
	return best;
}

export function size_of(v: Json | Spec): number {
	return JSON.stringify(v).length;
}
