/**
 * PLAIN SUBTREES (internal/plain.ts): a behaviour-free subtree rendered as one string must be
 * BYTE-identical to the same subtree rendered block by block through Svelte — every fixture, with
 * only Svelte's hydration comments removed (the string path has none). Plus: nesting depth has no
 * limit, and the string is built without recursion.
 */
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// @ts-ignore built by `pnpm bench:build`
import { components_for, render_content, set_plain } from '../bench/dist/entry.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const ELEMENT = '@builder.io/sdk:Element';
const COMMENT_RE = /<!--[^]*?-->/g;

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

function render(content: unknown, spec: { content?: unknown; data?: unknown; locale?: string }, plain: boolean): string {
	set_plain(plain);
	const comps = components_for(names_in(content));
	return render_content('ours', {
		content: structuredClone(content),
		model: 'page',
		apiKey: 'test-key',
		customComponents: comps.ours,
		canTrack: false,
		data: spec.content ? spec.data : undefined,
		locale: spec.content ? spec.locale : undefined
	}).body.replace(COMMENT_RE, '');
}

afterAll(() => set_plain(true));

describe('a plain subtree as a string = the same subtree through Svelte, byte for byte', () => {
	for (const dir of ['fixtures/real', 'fixtures/pages', 'fixtures/gen']) {
		if (!fs.existsSync(path.join(ROOT, dir))) continue; // fixtures/real is local-only
		for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
			if (!f.endsWith('.json') || f.endsWith('.data.json') || f.startsWith('big-')) continue;
			it(`${dir}/${f}`, () => {
				const spec = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'));
				const content = spec.content ?? spec;
				expect(render(content, spec, true)).toBe(render(content, spec, false));
			});
		}
	}

	it('attribute edge cases: escaping, booleans, hidden, translate, on* and invalid names, void tags', () => {
		const block = (id: string, extra: Record<string, unknown>) => ({ '@type': ELEMENT, id, ...extra });
		const blocks = [
			block('builder-a', { properties: { title: 'a "quoted" <b> & c', 'data-x': 0, disabled: true, hidden: false, translate: false, onclick: 'alert(1)', 'bad"name': 'x', Upper: 'Case' } }),
			block('builder-b', { properties: { hidden: 'until-found', open: '', required: 'yes' } }),
			block('builder-c', { tagName: 'img', properties: { src: '/x.png', alt: '' } }),
			block('builder-d', { tagName: 'span', children: [block('builder-e', { component: { name: 'Text', options: { text: '<em>hi</em> & bye' } } })] }),
			block('builder-f', { tagName: 'a', href: '/x?a=1&b=2', children: [block('builder-g', { component: { name: 'Text', options: { text: 0 } } })] }),
			block('builder-h', { hide: true, children: [block('builder-i', {})] })
		];
		const content = { id: 'c', data: { blocks } };
		const a = render(content, {}, true);
		expect(a).toBe(render(content, {}, false));
		expect(a).toContain('title="a &quot;quoted&quot; &lt;b> &amp; c"');
		expect(a).not.toContain('onclick');
	});
});

describe('no depth limit', () => {
	it('a 20 000-deep plain chain renders on the server', () => {
		let node: Record<string, unknown> = { '@type': ELEMENT, id: 'builder-leaf', component: { name: 'Text', options: { text: 'bottom' } } };
		for (let i = 0; i < 20000; i++) node = { '@type': ELEMENT, id: `builder-${i}`, children: [node] };
		// (not through render(): structuredClone itself recurses and cannot copy a tree this deep)
		set_plain(true);
		const html = render_content('ours', {
			content: { id: 'deep', data: { blocks: [node] } },
			model: 'page',
			apiKey: 'test-key',
			customComponents: [],
			canTrack: false
		}).body;
		expect(html).toContain('bottom');
		expect(html.split('<div').length).toBeGreaterThan(20000);
	});
});
