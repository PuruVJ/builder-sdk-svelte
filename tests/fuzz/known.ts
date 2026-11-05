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

/**
 * Rewrites for known differences, applied before every check:
 *
 *  - `Builder:RawText`: ours registers it as a built-in (README "What's exported"); the official
 *    Svelte SDK ships the block but does not register it, so it renders as an unknown component
 *    (its wrapper and children). There is no official output to compare our RawText against:
 *    renamed to an unregistered name, it renders the same in both.
 */
export function neutralize(spec: Spec): Spec {
	const json = JSON.stringify(spec);
	if (!json.includes('"Builder:RawText"')) return spec;
	const out = JSON.parse(json) as Spec;
	each_block(out, (b) => {
		if (b.component?.name === 'Builder:RawText') b.component.name = 'Unregistered RawText';
	});
	return out;
}

type Rule = { why: string; test: (spec: Spec, failure: Failure, json: string) => boolean };

const RULES: Rule[] = [];

/** Why this failure is a known official divergence, or null when it is ours to fix. */
export function known_official(spec: Spec, failure: Failure): string | null {
	if (!failure) return null;
	const json = JSON.stringify(spec);
	for (const rule of RULES) if (rule.test(spec, failure, json)) return rule.why;
	return null;
}

export type { Json };
