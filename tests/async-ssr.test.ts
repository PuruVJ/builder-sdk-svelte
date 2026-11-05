/**
 * ASYNC MODE (SSR): an app that turns on Svelte's `experimental.async` compiles every component in
 * that mode, the SDK's included. The same fixtures rendered on the server by each SDK compiled in
 * async mode (bench/dist-async) must give the same page (after normalize.ts) as compiled normally
 * (bench/dist), and must not throw. Needs both bundles: `pnpm test:async-ssr` builds them.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { normalize } from './normalize.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SYNC = path.join(ROOT, 'bench/dist/entry.js');
const ASYNC = path.join(ROOT, 'bench/dist-async/entry.js');
const built = fs.existsSync(SYNC) && fs.existsSync(ASYNC);
const ELEMENT = '@builder.io/sdk:Element';

function fixtures(): Array<[string, string]> {
	const out: Array<[string, string]> = [];
	for (const dir of ['fixtures/pages', 'fixtures/gen']) {
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
	const stack: unknown[] = [content];
	while (stack.length) {
		const v = stack.pop();
		if (!v || typeof v !== 'object') continue;
		const o = v as Record<string, any>;
		if (o['@type'] === ELEMENT && o.component?.name) names.add(o.component.name);
		for (const k in o) stack.push(o[k]);
	}
	return [...names].sort();
}

describe.skipIf(!built)('SDKs compiled in Svelte async mode render the same page on the server', async () => {
	const sync = built ? await import(SYNC) : null;
	const asyn = built ? await import(ASYNC) : null;
	for (const sdk of ['ours', 'official'] as const) {
		describe(sdk, () => {
			for (const [label, file] of fixtures()) {
				it(label, async () => {
					const spec = JSON.parse(fs.readFileSync(file, 'utf8')) as { content?: unknown; data?: Record<string, unknown>; locale?: string };
					const content = spec.content ?? spec;
					const props = (comps: Record<string, unknown[]>) => ({
						content: JSON.parse(JSON.stringify(content)),
						model: 'page',
						apiKey: 'test-key',
						customComponents: comps[sdk],
						canTrack: false,
						data: spec.content ? spec.data : undefined,
						locale: spec.content ? spec.locale : undefined
					});
					const names = names_in(content);
					const want = normalize(sync.render_content(sdk, props(sync.components_for(names))).body);
					const got = normalize((await asyn.render_content_async(sdk, props(asyn.components_for(names)))).body);
					expect(got.tree).toBe(want.tree);
					expect(got.css).toEqual(want.css);
				});
			}
		});
	}
});
