// @vitest-environment happy-dom
// internal/render.ts in the browser (window exists at module load): event handlers.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { create_content, type ContentInput } from '../../src/lib/internal/content.js';
import { action_handlers, component_props, wrapper_attrs } from '../../src/lib/internal/render.js';
import type { BuilderBlock, RegisteredComponent } from '../../src/lib/types.js';

afterEach(() => vi.restoreAllMocks());

const EL = '@builder.io/sdk:Element' as const;
let uid = 0;
function setup(blocks: BuilderBlock[], input: Partial<ContentInput> = {}) {
	let v = 0;
	const bump = vi.fn(() => {
		v++;
	});
	const out = create_content(
		{ model: 'page', content: { id: 'rb' + uid++, data: { blocks, state: { count: 0, nested: { n: 0 } } } }, ...input } as ContentInput,
		() => v,
		bump
	);
	return { ...out, bump };
}

describe('action_handlers (browser)', () => {
	it('one handler per action, lowercased, with the prefix', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-a', actions: { click: 'state.count++', MouseEnter: 'state.hover = true' } };
		const { ctx, scope } = setup([b]);
		const c = ctx.plan.compile(b);
		expect(Object.keys(action_handlers(c, scope, 'on'))).toEqual(['onclick', 'onmouseenter']);
		expect(Object.keys(action_handlers(c, scope, ''))).toEqual(['click', 'mouseenter']);
		expect(Object.keys(action_handlers(c, scope, 'on:'))).toEqual(['on:click', 'on:mouseenter']);
	});

	it('a handler writes root state through the writable proxy and bumps', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-w', actions: { click: 'state.count++; state.nested.n = 5; state.seen = event.type' } };
		const { ctx, scope, bump } = setup([b]);
		const h = action_handlers(ctx.plan.compile(b), scope, 'on');
		h.onclick(new Event('click'));
		expect(ctx.root.count).toBe(1);
		expect((ctx.root.nested as Record<string, unknown>).n).toBe(5);
		expect(ctx.root.seen).toBe('click');
		expect(bump).toHaveBeenCalled();
	});

	it('a handler in an item scope reads the item, cannot write it', () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const b: BuilderBlock = { '@type': EL, id: 'builder-it', actions: { click: 'state.picked = state.fooItem; state.fooItem = 1' } };
		const { ctx, scope } = setup([b]);
		action_handlers(ctx.plan.compile(b), scope.item('fooItem', 'X', 0), 'on').onclick(new Event('click'));
		expect(ctx.root.picked).toBe('X');
		expect(err).toHaveBeenCalled(); // the local write throws, logged
	});

	it('a handler returns the code result (statement code: undefined unless it returns)', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-rv', actions: { click: 'return 42' } };
		const { ctx, scope } = setup([b]);
		expect(action_handlers(ctx.plan.compile(b), scope, 'on').onclick(new Event('click'))).toBe(42);
	});

	it('no actions: none', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-no' };
		const { ctx, scope } = setup([b]);
		expect(action_handlers(ctx.plan.compile(b), scope, 'on')).toEqual({});
	});
});

describe('wrapper_attrs (browser)', () => {
	it("an element gets 'on' handlers, a component tag the bare event name", () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-wa', actions: { click: 'state.count++' }, properties: { title: 't' } };
		const { ctx, scope } = setup([b]);
		const c = ctx.plan.compile(b);
		const el = wrapper_attrs(c, scope, false);
		expect(el).not.toBe(c.attrs);
		expect(Object.keys(el)).toEqual([...Object.keys(c.attrs), 'onclick']);
		expect(typeof el.onclick).toBe('function');
		const comp = wrapper_attrs(c, scope, true);
		expect(Object.keys(comp)).toEqual([...Object.keys(c.attrs), 'click']);
		// the static attrs are never mutated
		expect('onclick' in c.attrs).toBe(false);
	});

	it('without actions: the static object', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-wn' };
		const { ctx, scope } = setup([b]);
		const c = ctx.plan.compile(b);
		expect(wrapper_attrs(c, scope, false)).toBe(c.attrs);
	});
});

describe('component_props (browser)', () => {
	it("a noWrap component gets the attributes with 'on:' handlers", () => {
		const comp: RegisteredComponent = { name: 'NoWrapB', component: () => null, noWrap: true };
		const b: BuilderBlock = { '@type': EL, id: 'builder-nwb', component: { name: 'NoWrapB' }, actions: { click: 'state.count = 9' } };
		const { ctx, scope } = setup([b], { customComponents: [comp] });
		const props = component_props(ctx.plan.compile(b), scope);
		const attrs = props.attributes as Record<string, unknown>;
		expect(Object.keys(attrs)).toContain('on:click');
		(attrs['on:click'] as (e: Event) => void)(new Event('click'));
		expect(ctx.root.count).toBe(9);
	});

	it('a wrapped component: empty attributes even with actions', () => {
		const comp: RegisteredComponent = { name: 'WrapB', component: () => null };
		const b: BuilderBlock = { '@type': EL, id: 'builder-wb', component: { name: 'WrapB' }, actions: { click: 'x' } };
		const { ctx, scope } = setup([b], { customComponents: [comp] });
		expect(component_props(ctx.plan.compile(b), scope).attributes).toEqual({});
	});
});
