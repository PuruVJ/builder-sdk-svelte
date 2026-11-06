// internal/render.ts on the server (no window): bindings, component props, wrapper attrs, repeat.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('placeholder-runtime', async () => ({
	evaluator: (await import('../../node_modules/@builder.io/sdk-svelte/src/functions/evaluate/browser-runtime/browser')).runInBrowser
}));

import { get } from 'svelte/store';
import { create_content, type ContentInput } from '../../src/lib/internal/content.js';
import { action_handlers, component_props, process, repeat_scopes, wrapper_attrs } from '../../src/lib/internal/render.js';
import type { BuilderBlock, BuilderContent, RegisteredComponent } from '../../src/lib/types.js';
import { getProcessedBlock } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-processed-block';
import { getBlockComponentOptions } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-block-component-options';
import { getRepeatItemData } from '../../node_modules/@builder.io/sdk-svelte/src/components/block/block.helpers';

afterEach(() => vi.restoreAllMocks());

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

const EL = '@builder.io/sdk:Element' as const;
let uid = 0;
function setup(blocks: BuilderBlock[] = [], input: Partial<ContentInput> = {}) {
	const content: BuilderContent = { id: 'r' + uid++, data: { blocks, state: { t: 'bound', c: 'blue', n: 3, list: [1, 2], obj: { a: 1 } } } };
	return create_content({ model: 'page', content, ...input } as ContentInput, () => 0, () => {});
}

describe('process', () => {
	it('a block without bindings is returned as is', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-a' };
		const { ctx, scope } = setup([b]);
		const c = ctx.plan.compile(b);
		expect(process(c, scope)).toBe(c);
	});

	it('applies bindings copy-on-write and recompiles', () => {
		const b: BuilderBlock = {
			'@type': EL,
			id: 'builder-b',
			tagName: 'section',
			component: { name: 'Text', options: { text: 'static' } },
			responsiveStyles: { large: { color: 'red' } },
			children: [{ '@type': EL, id: 'builder-child' }],
			bindings: {
				'component.options.text': 'state.t',
				'responsiveStyles.large.color': 'state.c',
				tagName: '"span"',
				'style.margin': '"1px"',
				'empty.path': '   '
			}
		};
		const snapshot = JSON.stringify(b);
		const { ctx, scope } = setup([b]);
		const c = ctx.plan.compile(b);
		const p = process(c, scope);
		expect(p).not.toBe(c);
		expect(p.options.text).toBe('bound');
		expect(p.css).toContain('color: blue;');
		expect(p.attrs.style).toBe('margin: 1px;');
		// tag from the block as written, never from a bound tagName
		expect(p.tag).toBe('section');
		expect(p.src.tagName).toBe('span');
		expect((p.src as Record<string, unknown>).empty).toEqual({ path: undefined });
		// only the objects along bound paths were copied
		expect(p.src.children).toBe(b.children);
		expect(p.src.component).not.toBe(b.component);
		expect(JSON.stringify(b)).toBe(snapshot);
		// a second render recomputes
		expect(process(c, scope)).not.toBe(p);
	});

	it('bindings evaluate in the item scope', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-i', bindings: { 'properties.title': 'state.fooItem + state.$index' } };
		const { ctx, scope } = setup([b]);
		const p = process(ctx.plan.compile(b), scope.item('fooItem', 'x', 4));
		expect(p.attrs.title).toBe('x4');
	});

	it('a throwing binding yields undefined (logged)', () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const b: BuilderBlock = { '@type': EL, id: 'builder-th', bindings: { 'properties.title': 'nope.x' } };
		const { ctx, scope } = setup([b]);
		const p = process(ctx.plan.compile(b), scope);
		expect(p.attrs.title).toBeUndefined();
		expect(err).toHaveBeenCalled();
	});

	// official getProcessedBlock: JSON clone + `properties`/`actions` objects always present
	const norm = (b: unknown, had: BuilderBlock) => {
		const j = JSON.parse(JSON.stringify(b));
		if (!had.properties && j.properties && !Object.keys(j.properties).length) delete j.properties;
		if (!had.actions && j.actions && !Object.keys(j.actions).length) delete j.actions;
		return j;
	};

	it('the processed block matches official getProcessedBlock (seeded sweep)', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const r = mulberry32(1234);
		const PATHS = [
			'component.options.text',
			'component.options.deep.nested.value',
			'component.options.list.0',
			'style.color',
			'responsiveStyles.large.color',
			'responsiveStyles.small.margin',
			'properties.title',
			'properties.href',
			'hide',
			'show',
			'tagName',
			'options.extra',
			'a.b.0.c',
			'a[1].b',
			'class'
		];
		const CODES = ['state.t', 'state.n', 'state.n * 2', '"lit"', 'state.list', 'state.obj', 'null', 'undefined', '', '  ', 'true', 'false', '0', 'state.t.length', 'state.missing', '"</style>"', '"😀"'];
		for (let i = 0; i < 300; i++) {
			const bindings: Record<string, string> = {};
			const n = 1 + Math.floor(r() * 4);
			for (let k = 0; k < n; k++) bindings[pick(r, PATHS)] = pick(r, CODES);
			const b: BuilderBlock = {
				'@type': EL,
				id: 'builder-s' + i,
				component: r() < 0.7 ? { name: 'Text', options: { text: 'hi', deep: { other: 1 } } } : undefined,
				responsiveStyles: r() < 0.5 ? { large: { color: 'red' } } : undefined,
				properties: r() < 0.3 ? { title: 't' } : undefined,
				children: r() < 0.3 ? [{ '@type': EL, id: 'builder-c' + i }] : undefined,
				bindings
			};
			if (!b.component) delete b.component;
			if (!b.responsiveStyles) delete b.responsiveStyles;
			if (!b.properties) delete b.properties;
			if (!b.children) delete b.children;
			const { ctx, scope } = setup([b]);
			const ours = process(ctx.plan.compile(b), scope).builder_block;
			const official = getProcessedBlock({
				block: JSON.parse(JSON.stringify(b)),
				localState: undefined,
				rootState: ctx.root,
				rootSetState: () => {},
				context: {}
			} as never);
			expect(norm(ours, b), JSON.stringify(bindings)).toEqual(norm(official, b));
		}
	});
});

describe('component_props', () => {
	const Comp = (flags?: RegisteredComponent['shouldReceiveBuilderProps'], extra: Partial<RegisteredComponent> = {}): RegisteredComponent => ({
		name: 'Comp' + uid++,
		component: () => null,
		shouldReceiveBuilderProps: flags,
		...extra
	});

	it('options + an empty attributes object (wrapped component)', () => {
		const comp = Comp();
		const b: BuilderBlock = { '@type': EL, id: 'builder-cp', component: { name: comp.name, options: { a: 1 } }, options: { b: 2 } };
		const { ctx, scope } = setup([b], { customComponents: [comp] });
		const c = ctx.plan.compile(b);
		const props = component_props(c, scope);
		expect(props).toEqual({ a: 1, b: 2, attributes: {} });
		expect(props).not.toBe(c.options);
	});

	it('each builder prop flag', () => {
		const link = { link: true };
		const comp = Comp({ builderBlock: true, builderContext: true, builderLinkComponent: true, builderComponents: true });
		const b: BuilderBlock = { '@type': EL, id: 'builder-f', component: { name: comp.name } };
		const { ctx, scope } = setup([b], { customComponents: [comp], linkComponent: link });
		const c = ctx.plan.compile(b);
		const props = component_props(c, scope);
		expect(props.builderBlock).toBe(c.builder_block);
		expect(props.builderContext).toBe(scope.store());
		expect(props.builderLinkComponent).toBe(link);
		expect(props.builderComponents).toBe(ctx.registry.as_object('page'));
		expect(get(props.builderContext as never)).toMatchObject({ model: 'page' });
	});

	it('flags off: no builder props', () => {
		const comp = Comp({ builderBlock: false, builderContext: false, builderLinkComponent: false, builderComponents: false });
		const b: BuilderBlock = { '@type': EL, id: 'builder-g', component: { name: comp.name } };
		const { ctx, scope } = setup([b], { customComponents: [comp] });
		expect(Object.keys(component_props(ctx.plan.compile(b), scope))).toEqual(['attributes']);
	});

	it('no component: options only', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-nc', options: { x: 1 } };
		const { ctx, scope } = setup([b]);
		expect(component_props(ctx.plan.compile(b), scope)).toEqual({ x: 1, attributes: {} });
	});

	it('noWrap: attributes are the wrapper attributes (no handlers on the server)', () => {
		const comp = Comp(undefined, { noWrap: true });
		const b: BuilderBlock = { '@type': EL, id: 'builder-nw', component: { name: comp.name }, actions: { click: 'state.x = 1' }, properties: { title: 't' } };
		const { ctx, scope } = setup([b], { customComponents: [comp] });
		const c = ctx.plan.compile(b);
		const props = component_props(c, scope);
		expect(props.attributes).toEqual(c.attrs);
		expect(props.attributes).not.toBe(c.attrs);
		expect(Object.keys(props.attributes as object)).not.toContain('on:click');
	});

	it('text_of: a Text block template evaluated in its scope', () => {
		const b: BuilderBlock = {
			'@type': EL,
			id: 'builder-tx',
			component: { name: 'Text', options: { text: 'a {{state.t}} b {{state.n + 1}} c {{state.missing}} {{state.obj}}' } }
		};
		const { ctx, scope } = setup([b]);
		expect(component_props(ctx.plan.compile(b), scope).text).toBe('a bound b 4 c undefined [object Object]');
	});

	it('text_of matches official getBlockComponentOptions (Text, no block.options)', () => {
		const texts = ['{{state.t}}', 'x{{state.n}}y{{state.n*2}}z', '{{ state.list }}', '{{}}', '{{state.t}', 'no template', '{{"a}"}}', '{{state.t}}{{state.t}}'];
		for (const text of texts) {
			const b: BuilderBlock = { '@type': EL, id: 'builder-ot', component: { name: 'Text', options: { text, other: 1 } } };
			const { ctx, scope } = setup([b]);
			const { attributes: _a, ...ours } = component_props(ctx.plan.compile(b), scope);
			const official = getBlockComponentOptions(b as never, { localState: undefined, rootState: ctx.root, rootSetState: () => {}, context: {} } as never);
			expect(ours, text).toEqual(official);
		}
	});

	// Regression: official getBlockComponentOptions spreads a Text block's component.options AGAIN after
	// block.options (evaluateTextComponentTextOption returns `{...component.options, text}`), so for a
	// Text block with a string text, component.options win over block.options. Ours let block.options win.
	it('a Text block: component.options win over block.options, as in the official SDK', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-ord', component: { name: 'Text', options: { text: 'c', k: 'component' } }, options: { k: 'block' } };
		const { ctx, scope } = setup([b]);
		const { attributes: _a, ...ours } = component_props(ctx.plan.compile(b), scope);
		const official = getBlockComponentOptions(b as never, { localState: undefined, rootState: ctx.root, rootSetState: () => {}, context: {} } as never);
		expect(ours).toEqual(official);
	});
});

describe('action_handlers / wrapper_attrs (server)', () => {
	it('no handlers on the server; wrapper attrs are the static ones', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-ah', actions: { click: 'state.x = 1' } };
		const { ctx, scope } = setup([b]);
		const c = ctx.plan.compile(b);
		expect(action_handlers(c, scope, 'on')).toEqual({});
		expect(wrapper_attrs(c, scope, false)).toBe(c.attrs);
		expect(wrapper_attrs(c, scope, true)).toBe(c.attrs);
	});

	it('a block without actions: the static attrs object itself', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-na' };
		const { ctx, scope } = setup([b]);
		const c = ctx.plan.compile(b);
		expect(wrapper_attrs(c, scope, false)).toBe(c.attrs);
		expect(action_handlers(c, scope, '')).toEqual({});
	});
});

describe('repeat_scopes', () => {
	it('one item scope per element (official getRepeatItemData)', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-rp', repeat: { collection: 'state.list' } };
		const { ctx, scope } = setup([b]);
		const scopes = repeat_scopes(ctx.plan.compile(b), scope)!;
		const official = getRepeatItemData({ block: b as never, context: { localState: undefined, rootState: ctx.root, rootSetState: () => {}, context: {} } as never })!;
		expect(scopes.map((s) => s.local)).toEqual(official.map((o) => o.context.localState));
		expect(scopes[1].local).toEqual({ $index: 1, $item: 2, listItem: 2, $listItemIndex: 1 });
	});

	it('itemName and nested items', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-rn', repeat: { collection: 'state.obj.a ? [7] : []', itemName: 'it' } };
		const { ctx, scope } = setup([b]);
		const outer = scope.item('o', 'O', 0);
		const scopes = repeat_scopes(ctx.plan.compile(b), outer)!;
		expect(scopes[0].local).toEqual({ $index: 0, $item: 7, o: 'O', $oIndex: 0, it: 7, $itIndex: 0 });
	});

	it('non-array -> null', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		for (const code of ['state.n', 'state.obj', 'state.t', 'null', 'state.missing', 'nope.x', '"abc"', '({length: 2})']) {
			const b: BuilderBlock = { '@type': EL, id: 'builder-rx', repeat: { collection: code } };
			const { ctx, scope } = setup([b]);
			expect(repeat_scopes(ctx.plan.compile(b), scope), code).toBeNull();
		}
	});

	it('an empty array -> no scopes', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-re', repeat: { collection: '[]' } };
		const { ctx, scope } = setup([b]);
		expect(repeat_scopes(ctx.plan.compile(b), scope)).toEqual([]);
	});
});
