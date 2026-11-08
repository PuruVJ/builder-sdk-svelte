/**
 * Inputs of the counted benches (bench/count/*.bench.ts): the same fixtures the timed benches read
 * (`pnpm fixtures` writes fixtures/gen and fixtures/pages), read once per file and parsed fresh in
 * each case's `setup`, so every counted render gets a new content object (the per-request case).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ELEMENT = '@builder.io/sdk:Element';

export type Json = Record<string, any>;

/** The raw text of a fixture, `gen/page-50k` → fixtures/gen/page-50k.json. */
export function fixture_text(name: string): string {
	return fs.readFileSync(path.join(ROOT, 'fixtures', `${name}.json`), 'utf8');
}

/** A generated spec is `{ content, data, locale }`; a captured content is the content itself. */
export function spec_of(raw: string): { content: Json; data?: Json; locale?: string } {
	const spec = JSON.parse(raw);
	return spec.content ? spec : { content: spec };
}

/** Every custom component name the content uses (the registry each SDK is handed). */
export function names_in(v: unknown, out = new Set<string>()): Set<string> {
	if (!v || typeof v !== 'object') return out;
	const o = v as Json;
	if (o['@type'] === ELEMENT && o.component?.name) out.add(o.component.name);
	for (const k in o) names_in(o[k], out);
	return out;
}

/** A deep copy with every element id suffixed (so repeated blocks stay unique, like real content). */
function reid<T>(v: T, suffix: string): T {
	if (Array.isArray(v)) return v.map((x) => reid(x, suffix)) as T;
	if (!v || typeof v !== 'object') return v;
	const out: Json = {};
	for (const k in v as Json) out[k] = reid((v as Json)[k], suffix);
	if (out['@type'] === ELEMENT && typeof out.id === 'string') out.id += suffix;
	return out as T;
}

/** The content with its top-level blocks repeated `factor` times: a page `factor` times as long. */
export function repeat_blocks(content: Json, factor: number): Json {
	const blocks: Json[] = content.data?.blocks ?? [];
	const n = Math.max(1, Math.round(factor));
	const out: Json[] = [];
	for (let i = 0; i < n; i++) out.push(...(i === 0 ? blocks : reid(blocks, `-r${i}`)));
	return { ...content, data: { ...content.data, blocks: out } };
}

/** The first Text block's text, changed: one edit, the way the editor sends it (a whole new copy). */
export function edit_one_text(content: Json, text: string): Json {
	const next = JSON.parse(JSON.stringify(content));
	let done = false;
	(function walk(v: unknown) {
		if (done || !v || typeof v !== 'object') return;
		const o = v as Json;
		if (o['@type'] === ELEMENT && o.component?.name === 'Text' && typeof o.component.options?.text === 'string') {
			o.component.options.text = text;
			done = true;
			return;
		}
		for (const k in o) walk(o[k]);
	})(next);
	if (!done) throw new Error('no Text block to edit');
	return next;
}
