/**
 * APP SHAPE: the patterns the field app's own components use, through both SDKs (bench/app/*):
 * Svelte 4 components with `export let builderBlock`, `<Blocks>` for block.children and option arrays,
 * noWrap roots spreading `attributes`, `builderContext` read as a store, an option named `children`,
 * built-ins registered with no component, and whole pages with several <Content> roots sharing a
 * 230-entry component list.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { normalize } from './normalize.js';
// @ts-ignore built by `pnpm bench:build`
import { app_components, components_for, render_app_page, render_content } from '../bench/dist/entry.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const ELEMENT = '@builder.io/sdk:Element';
type Sdk = 'official' | 'ours';

const text = (id: string, t: string) => ({ '@type': ELEMENT, id, component: { name: 'Text', options: { text: t } } });

function names_in(content: unknown): string[] {
	const names = new Set<string>();
	(function walk(v: unknown) {
		if (!v || typeof v !== 'object') return;
		const o = v as Record<string, any>;
		if (o['@type'] === ELEMENT && o.component?.name) names.add(o.component.name);
		for (const k in o) walk(o[k]);
	})(content);
	return [...names].sort();
}

function both(roots: (sdk: Sdk) => unknown[]) {
	const out = {} as Record<Sdk, ReturnType<typeof normalize>>;
	for (const sdk of ['official', 'ours'] as const) out[sdk] = normalize(render_app_page(sdk, roots(sdk)).body);
	return out;
}

describe('field component patterns render the same through both SDKs', () => {
	const blocks = [
		{ '@type': ELEMENT, id: 'builder-removed', component: { name: 'Image', options: { image: 'x.png' } }, children: [text('builder-in-removed', 'inside a removed built-in')] },
		{ '@type': ELEMENT, id: 'builder-childopt', component: { name: '@app/ChildrenOption', options: { children: [text('builder-opt-child', 'option child')] } } },
		{ '@type': ELEMENT, id: 'builder-ctx', component: { name: '@app/ContextReader', options: {} } },
		{ '@type': ELEMENT, id: 'builder-foot', component: { name: 'Content - Footer', options: { title: 'Footer' } }, responsiveStyles: { large: { marginTop: '4px' } } },
		{ '@type': ELEMENT, id: 'builder-leaf', component: { name: 'Leaf A', options: { title: 'Hello', presentationBlocks: [text('builder-pres', 'pres')] } }, children: [text('builder-kid', 'kid')] }
	];
	const content = { id: 'c1', data: { title: 'The Title', blocks } };
	const names = names_in(content);
	const r = both((sdk) => [{ model: 'page', content: structuredClone(content), components: app_components(sdk, { names, size: 20 }), locale: 'fr-FR' }]);

	it('same tree and CSS', () => {
		expect(r.ours.tree).toBe(r.official.tree);
		expect(r.official.css.filter((x) => !r.ours.css.includes(x))).toEqual([]);
	});
	it('a built-in registered without a component still renders its children', () => {
		expect(r.ours.tree).toContain('inside a removed built-in');
	});
	it('builderContext is a store with the model, the content data and the locale', () => {
		expect(r.ours.tree).toContain('data-model="page"');
		expect(r.ours.tree).toContain('data-title="The Title"');
		expect(r.ours.tree).toContain('data-locale="fr-FR"');
	});
	it('a noWrap root gets the wrapper attributes', () => {
		expect(r.ours.tree).toMatch(/<footer[^>]*builder-id="builder-foot"/);
	});
});

describe('whole field pages (4 Content roots, 230-entry list) render the same', () => {
	// captured pages when present locally (gitignored), else the synthetic production-shaped ones
	const real = path.join(ROOT, 'fixtures/real');
	const dir = fs.existsSync(real) ? real : path.join(ROOT, 'fixtures/pages');
	const pages = [...new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.pageContent.json')).map((f) => f.split('.')[0]))];
	for (const page of pages) {
		it(page, () => {
			const load = (kind: string) => {
				const file = path.join(dir, `${page}.${kind}.json`);
				if (!fs.existsSync(file)) return null;
				const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
				return spec.content ?? spec;
			};
			const kinds = ['accessibilityContent', 'pageContent', 'content', 'getFooterContent'];
			const contents = kinds.map(load).filter(Boolean);
			const names = names_in(contents);
			const r = both((sdk) => {
				const list = app_components(sdk, { names, size: 230 });
				return contents.map((c) => ({ model: 'page', content: structuredClone(c), components: list }));
			});
			expect(r.ours.tree).toBe(r.official.tree);
			expect(r.official.css.filter((x) => !r.ours.css.includes(x))).toEqual([]);
		});
	}
});

describe('a container handing `builderComponents` back to <Blocks> stays in the same plan', () => {
	// The stand-in component renders its option block arrays through
	// `<Blocks registeredComponents={builderComponents}>` (the field container pattern). That object
	// must map back to the content's own registry: a new one would mean a second, unprepared plan —
	// every nested block compiled again and emitting its own <style> next to the page's one sheet.
	const BLOCK_STYLE_RE = /data-id="builderio-block"/g;
	const E = '@builder.io/sdk:Element';
	const styled = (id: string) => ({ '@type': E, id, component: { name: 'Text', options: { text: id } }, responsiveStyles: { large: { color: 'red' } } });
	const content = {
		id: 'nested',
		data: { blocks: [{ '@type': E, id: 'builder-box', component: { name: 'Gen - Container', options: { slotBlocks: [styled('builder-n1'), styled('builder-n2')] } } }] }
	};
	it('nested blocks render with no per-block style tag; their rules are in the sheet', () => {
		const html = render_content('ours', {
			content,
			model: 'page',
			apiKey: 'k',
			customComponents: components_for(['Gen - Container']).ours,
			canTrack: false
		}).body;
		expect(html).toContain('builder-n2');
		expect(html.match(BLOCK_STYLE_RE)).toBeNull();
		expect(html).toMatch(/data-id="builderio-blocks"[^>]*>[^<]*\.builder-n1/);
	});
});
