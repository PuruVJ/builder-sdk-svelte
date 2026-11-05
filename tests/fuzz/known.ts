/**
 * Divergence classes the fuzz test does not fail on: official-SDK bugs and quirks we deliberately do
 * not copy (README "Known differences").
 *
 *  - `neutralize(spec)` rewrites a spec so a known difference cannot show (the rest of the content
 *    is still compared) — used where such a rewrite exists;
 *  - `known_official(spec, failure)` recognises a failure of a known class that cannot be rewritten
 *    away, and says why it is skipped.
 */
import type { Failure } from './check.js';
import type { Json, Spec } from './gen.js';

const ELEMENT = '@builder.io/sdk:Element';

/** Apply `fn` to every block in the spec (in place). */
function each_block(v: unknown, fn: (b: Record<string, any>) => void): void {
	const stack: unknown[] = [v];
	while (stack.length) {
		const x = stack.pop();
		if (!x || typeof x !== 'object') continue;
		const o = x as Record<string, any>;
		if (o['@type'] === ELEMENT) fn(o);
		for (const k in o) stack.push(o[k]);
	}
}

/** Every string in `v`, rewritten by `fn` (in place). */
function each_string(v: unknown, fn: (s: string) => string): void {
	if (!v || typeof v !== 'object') return;
	const o = v as Record<string, unknown>;
	for (const k in o) {
		if (typeof o[k] === 'string') o[k] = fn(o[k] as string);
		else each_string(o[k], fn);
	}
}

const CLOSE_STYLE_RE = /<\/style/gi;

/**
 * Rewrites for known differences, applied before every check:
 *
 *  - `Builder:RawText`: ours registers it as a built-in (README "What's exported"); the official
 *    Svelte SDK ships the block but does not register it, so it renders as an unknown component
 *    (its wrapper and children). There is no official output to compare our RawText against:
 *    renamed to an unregistered name, it renders the same in both.
 *  - `</style` in a style value: ours writes it `<\/style` (internal/tags.ts) so it cannot close
 *    the style tag; the official SDK lets it, and the rest becomes markup. Written `<\/style` in
 *    the content itself, both render the same (tests/fuzz-regressions.test.ts checks ours escapes).
 */
export function neutralize(spec: Spec): Spec {
	const json = JSON.stringify(spec);
	const raw_text = json.includes('"Builder:RawText"');
	const close_style = /<\/style/i.test(json);
	if (!raw_text && !close_style) return spec;
	const out = JSON.parse(json) as Spec;
	const escape = (s: string) => s.replace(CLOSE_STYLE_RE, '<\\/style');
	each_block(out, (b) => {
		if (b.component?.name === 'Builder:RawText') b.component.name = 'Unregistered RawText';
		if (close_style) for (const key of ['style', 'responsiveStyles', 'animations']) each_string(b[key], escape);
	});
	return out;
}

type Rule = { why: string; test: (spec: Spec, failure: Failure, json: string) => boolean };

const CLASS_ID_RE = /\.(builder-[a-z0-9-]+?)(?=[\s{:.>,]|-breakpoints)/g;

const RULES: Rule[] = [
	{
		// During SSR with tracking allowed, every A/B variation renders (hidden) next to the default,
		// each from its own plan and sheet. A variation block that never renders (a Text's children, a
		// hidden parent's) keeps its rules in its variation's sheet, and they reach a rendered block of
		// another variation that shares its id. Variations do share ids (they are edited copies), but
		// a shared id whose styles differ on a block that never renders is a corner of a corner; the
		// official SDK emits every rendered variation block's styles globally during SSR anyway.
		why: 'duplicate block id across A/B variations, on a block that never renders (README: Known differences)',
		test: (spec, failure) => {
			if (failure.kind !== 'css-extra' || !spec.content.variations) return false;
			// the id is in two of the contents rendered (the default and each variation)
			const contents = [spec.content.data ?? {}, ...Object.values(spec.content.variations as object)].map((c) => JSON.stringify(c));
			return [...failure.detail.matchAll(CLASS_ID_RE)].every((m) => contents.filter((c) => c.includes(`"${m[1]}"`)).length >= 2);
		}
	}
];

/** Why this failure is a known official divergence, or null when it is ours to fix. */
export function known_official(spec: Spec, failure: Failure): string | null {
	if (!failure) return null;
	const json = JSON.stringify(spec);
	for (const rule of RULES) if (rule.test(spec, failure, json)) return rule.why;
	return null;
}

export type { Json };
