/**
 * EQUIVALENCE: the same content through both SDKs' server render gives the same page — the same
 * DOM (after normalize.ts), the same CSS rules, and the same props reaching every custom component
 * (the stand-in echoes a digest of what it received).
 *
 * Fixtures: the synthetic production-shaped pages (fixtures/pages), any real contents captured
 * locally under fixtures/real (gitignored; scripts/grab-real.mjs), plus
 * the generated shapes (fixtures/gen) that exercise bindings, repeats, localized values, show/hide,
 * text templates, actions and nesting.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { normalize } from './normalize.js';
// @ts-ignore built by `pnpm bench:build`
import { components_for, render_content, set_echo } from '../bench/dist/entry.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const ELEMENT = '@builder.io/sdk:Element';
const BUILDER_ID_RE = /builder-id="([^"]+)"/g;
const CLASS_ID_RE = /\.(builder-[a-z0-9-]+?)(?=[\s{:.>,]|-breakpoints)/g;

function fixtures(): Array<[string, string]> {
	const out: Array<[string, string]> = [];
	for (const dir of ['fixtures/real', 'fixtures/pages', 'fixtures/gen']) {
		const abs = path.join(ROOT, dir);
		if (!fs.existsSync(abs)) continue;
		for (const f of fs.readdirSync(abs).sort()) {
			if (!f.endsWith('.json') || f.endsWith('.data.json') || f.startsWith('big-')) continue;
			out.push([`${dir}/${f}`, path.join(abs, f)]);
		}
	}
	return out;
}

function names_in(content: unknown): string[] {
	const names = new Set<string>();
	const seen = new Set<object>();
	(function walk(v: unknown) {
		if (!v || typeof v !== 'object' || seen.has(v)) return;
		seen.add(v);
		const o = v as Record<string, any>;
		if (o['@type'] === ELEMENT && o.component?.name) names.add(o.component.name);
		for (const k in o) walk(o[k]);
	})(content);
	return [...names].sort();
}

beforeAll(() => set_echo(true));

describe('both SDKs render the same page', () => {
	for (const [label, file] of fixtures()) {
		it(label, () => {
			const raw = fs.readFileSync(file, 'utf8');
			const spec = JSON.parse(raw) as { content?: unknown; data?: Record<string, unknown>; locale?: string };
			// A generated fixture can carry render props: { content, data, locale }.
			const content = spec.content ?? spec;
			const comps = components_for(names_in(content));
			const render = (sdk: 'official' | 'ours') =>
				normalize(
					render_content(sdk, {
						content: JSON.parse(JSON.stringify(content)),
						model: 'page',
						apiKey: 'test-key',
						customComponents: comps[sdk],
						canTrack: false,
						// render props only from a generated spec (a captured content's own .data is not a prop)
						data: spec.content ? spec.data : undefined,
						locale: spec.content ? spec.locale : undefined
					}).body
				);
			const official = render('official');
			const ours = render('ours');
			expect(ours.tree).toBe(official.tree);
			// Every rule the official page has, ours has.
			expect(official.css.filter((r) => !ours.css.includes(r))).toEqual([]);
			// Ours may carry rules for blocks the page never renders (its one sheet is built from the whole
			// content): each such rule must target a block id that is NOT in the rendered page — no effect.
			const extra = ours.css.filter((r) => !official.css.includes(r));
			const rendered_ids = new Set([...ours.tree.matchAll(BUILDER_ID_RE)].map((m) => m[1]));
			expect(extra.filter((r) => [...r.matchAll(CLASS_ID_RE)].some((m) => rendered_ids.has(m[1])))).toEqual([]);
		});
	}
});
