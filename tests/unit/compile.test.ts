// internal/compile.ts: Plan (keys, cache, the one sheet, flags), compile_block fields, block_css.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('placeholder-runtime', async () => ({
	evaluator: (await import('../../node_modules/@builder.io/sdk-svelte/src/functions/evaluate/browser-runtime/browser')).runInBrowser
}));
import { Plan, block_css, plan_for, type PlanOptions } from '../../src/lib/internal/compile.js';
import { registry_for } from '../../src/lib/internal/registry.js';
import { style_attr } from '../../src/lib/internal/css.js';
import type { BuilderBlock, RegisteredComponent } from '../../src/lib/types.js';
import { createCssClass } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/css';
import { getMaxWidthQueryForSize, getSizesForBreakpoints } from '../../node_modules/@builder.io/sdk-svelte/src/constants/device-sizes';
import { camelToKebabCase } from '../../node_modules/@builder.io/sdk-svelte/src/functions/camel-to-kebab-case';
import { checkIsDefined } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/nullable';
import { getBlockProperties } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-block-properties';
import { getBlockActions } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-block-actions';
import { resolveLocalizedValues } from '../../node_modules/@builder.io/sdk-svelte/src/functions/extract-localized-values';

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
const LOC = '@builder.io/core:LocalizedValue';
let uid = 0;
const id = (p = 'b') => `builder-${p}${uid++}`;

function plan(opts: Partial<PlanOptions> = {}, blocks?: BuilderBlock[]): Plan {
	const p = new Plan({ registry: registry_for(undefined), model: 'page', locale: undefined, breakpoints: undefined, ...opts });
	if (blocks) p.prepare(blocks);
	return p;
}

// ── Plan.key ─────────────────────────────────────────────────────────────────────────────────────
describe('Plan.key', () => {
	it('static: the block itself', () => {
		const p = plan();
		const b: BuilderBlock = { '@type': EL, id: 'x' };
		expect(p.key([b], b)).toBe(b);
	});

	it('live: ids, unique within the list', () => {
		const p = plan({ live: true });
		const list: BuilderBlock[] = [
			{ id: 'a' },
			{ id: 'b' },
			{ id: 'a' },
			{},
			{ id: '' },
			{ id: 5 as unknown as string },
			{ id: 'a' },
			{ id: '#3' }
		];
		expect(list.map((b) => p.key(list, b))).toEqual(['a', 'b', 'a~1', '#3', '#4', '#5', 'a~2', '#3~1']);
		expect(new Set(list.map((b) => p.key(list, b))).size).toBe(list.length);
	});

	// Regression: a generated `id~n` key was not recorded as used, so a block whose id IS `a~1`
	// collided with the second `a` (a duplicate key in the keyed each of a live tree).
	it('live: an id that looks like a generated key never collides', () => {
		const p = plan({ live: true });
		const list: BuilderBlock[] = [{ id: 'a' }, { id: 'a' }, { id: 'a~1' }];
		const keys = list.map((b) => p.key(list, b));
		expect(new Set(keys).size).toBe(3);
	});

	it('live: null/undefined holes get index keys', () => {
		const p = plan({ live: true });
		const list = [null, undefined, { id: 'x' }] as unknown as BuilderBlock[];
		expect(p.key(list, list[2])).toBe('x');
		expect(p.key(list, list[0])).toBe('#0');
		expect(p.key(list, list[1])).toBe('#1');
	});

	it('live: the same block twice in a list keeps its first key', () => {
		const p = plan({ live: true });
		const b: BuilderBlock = { id: 'dup' };
		const list = [b, { id: 'other' }, b];
		expect(p.key(list, b)).toBe('dup');
	});

	it('live: the same list object reuses its key map; a new list is keyed afresh', () => {
		const p = plan({ live: true });
		const a: BuilderBlock = { id: 'a' };
		const b: BuilderBlock = { id: 'b' };
		const list = [a, b];
		expect(p.key(list, b)).toBe('b');
		// mutated in place (never done by the SDK): the first map is still used
		const late: BuilderBlock = { id: 'late' };
		list.unshift({ id: 'b' });
		list.push(late);
		expect(p.key(list, b)).toBe('b');
		expect(p.key(list, late)).toBe(late); // not in the map: the block itself
		const fresh = [...list];
		expect(p.key(fresh, b)).toBe('b~1');
	});
});

// ── compile cache ────────────────────────────────────────────────────────────────────────────────
describe('Plan.compile', () => {
	it('same block -> same Compiled; compile_fresh never caches', () => {
		const p = plan();
		const b: BuilderBlock = { '@type': EL, id: id() };
		const c = p.compile(b);
		expect(p.compile(b)).toBe(c);
		const f = p.compile_fresh(b, b.tagName);
		expect(f).not.toBe(c);
		expect(f).toEqual(c);
		expect(p.compile(b)).toBe(c);
	});

	it('a resolved nested-block copy that renders as its block compiles as the block', () => {
		const nested: BuilderBlock = { '@type': EL, id: id('n'), component: { name: 'Text', options: { text: { '@type': LOC, Default: 'd', fr: 'bonjour' } } } };
		const parent: BuilderBlock = { '@type': EL, id: id('p'), component: { name: 'Columns', options: { columns: [{ blocks: [nested] }] } } };
		const p = plan({ locale: 'fr' }, [parent]);
		const cp = p.compile(parent);
		const copy = (cp.options.columns as Array<{ blocks: BuilderBlock[] }>)[0].blocks[0];
		expect(copy).not.toBe(nested);
		expect(copy.component!.options!.text).toBe('bonjour');
		expect(p.compile(copy)).toBe(p.compile(nested));
		expect(p.compile(nested).options.text).toBe('bonjour');
		expect(cp.builder_block).not.toBe(parent);
	});

	it('a copy that changed more than its component options compiles on its own', () => {
		// (the parent owns a localized value of its own, so its options are resolved)
		const nested: BuilderBlock = {
			'@type': EL,
			id: id('n'),
			component: { name: 'Text', options: { text: { '@type': LOC, Default: 'd', fr: 'texte' } } },
			properties: { title: { '@type': LOC, Default: 'd', fr: 'titre' } as unknown as string }
		};
		const parent: BuilderBlock = { '@type': EL, id: id('p'), component: { name: 'Columns', options: { columns: [{ blocks: [nested] }] } } };
		const p = plan({ locale: 'fr' }, [parent]);
		const copy = (p.compile(parent).options.columns as Array<{ blocks: BuilderBlock[] }>)[0].blocks[0];
		expect(p.compile(copy)).not.toBe(p.compile(nested));
		expect(p.compile(copy).attrs.title).toBe('titre');
		expect(p.compile(copy).options.text).toBe('texte');
	});

	// BUG: the official SDK resolves every localized value inside a block's component.options, nested
	// blocks' `properties` / `style` / `responsiveStyles` included (resolveLocalizedValues traverses
	// the whole options tree and mutates in place). The content walk (find_blocks) only notes a
	// localized value under some block's component.options, and pushes a found block's other fields
	// with no owner, so a nested block whose ONLY localized value is in its properties leaves its
	// container unresolved: the column's block renders `title="[object Object]"`.
	it.fails("a nested block's localized properties are resolved (official resolveLocalizedValues)", () => {
		const nested: BuilderBlock = { '@type': EL, id: id('n'), properties: { title: { '@type': LOC, Default: 'd', fr: 'titre' } as unknown as string } };
		const parent: BuilderBlock = { '@type': EL, id: id('p'), component: { name: 'Columns', options: { columns: [{ blocks: [nested] }] } } };
		const official = resolveLocalizedValues(structuredClone(parent) as never, 'fr') as BuilderBlock;
		const official_title = (official.component!.options!.columns as Array<{ blocks: BuilderBlock[] }>)[0].blocks[0].properties!.title;
		expect(official_title).toBe('titre');
		const p = plan({ locale: 'fr' }, [parent]);
		const copy = (p.compile(parent).options.columns as Array<{ blocks: BuilderBlock[] }>)[0].blocks[0];
		expect(p.compile(copy).attrs.title).toBe(official_title);
	});
});

// ── compile_block fields ─────────────────────────────────────────────────────────────────────────
describe('compile_block fields', () => {
	it('comp: null without a name, undefined when unregistered (warned), the entry when registered', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const entry: RegisteredComponent = { name: 'CompX', component: () => null, noWrap: true };
		const p = plan({ registry: registry_for([entry]) });
		expect(p.compile({ '@type': EL }).comp).toBeNull();
		expect(p.compile({ '@type': EL, component: { name: '' } }).comp).toBeNull();
		expect(p.compile({ '@type': EL, component: { name: 'Nope-compile' } }).comp).toBeUndefined();
		expect(warn).toHaveBeenCalledTimes(1);
		const c = p.compile({ '@type': EL, component: { name: 'CompX' } });
		expect(c.comp).toBe(entry);
		expect(c.no_wrap).toBe(true);
		// restricted by model
		const m = plan({ registry: registry_for([{ name: 'OnlySection', component: null, models: ['section'] }]) });
		expect(m.compile({ '@type': EL, component: { name: 'OnlySection' } }).comp).toBeUndefined();
	});

	it('options: component.options + block.options (block wins); shared frozen empty', () => {
		const p = plan();
		const opts = { a: 1, b: 1 };
		const c = p.compile({ '@type': EL, component: { name: 'Text', options: opts }, options: { b: 2, c: 3 } });
		expect(c.options).toEqual({ a: 1, b: 2, c: 3 });
		expect(p.compile({ '@type': EL, component: { name: 'Text', options: opts } }).options).toBe(opts);
		const e1 = p.compile({ '@type': EL }).options;
		const e2 = p.compile({ '@type': EL, component: { name: 'Text' } }).options;
		expect(e1).toBe(e2);
		expect(Object.isFrozen(e1)).toBe(true);
		expect(p.compile({ '@type': EL, options: { x: 1 } }).options).toEqual({ x: 1 });
	});

	it('text_tpl: `{{expr}}` in a Text block, compiled', () => {
		const p = plan();
		const c = p.compile({ '@type': EL, component: { name: 'Text', options: { text: 'a {{state.x}} b {{ 1 + 1 }}{{y}}' } } });
		expect(c.text_tpl!.map((x) => (typeof x === 'string' ? x : x.code))).toEqual(['a ', 'state.x', ' b ', ' 1 + 1 ', '', 'y', '']);
		expect(typeof (c.text_tpl![1] as { fn: unknown }).fn).toBe('function');
		expect(p.compile({ '@type': EL, component: { name: 'Text', options: { text: 'no tpl' } } }).text_tpl).toBeNull();
		expect(p.compile({ '@type': EL, component: { name: 'Text', options: { text: 5 } } }).text_tpl).toBeNull();
		expect(p.compile({ '@type': EL, component: { name: 'Other', options: { text: '{{x}}' } } }).text_tpl).toBeNull();
		// `{{` without a full template: one literal part
		expect(p.compile({ '@type': EL, component: { name: 'Text', options: { text: 'a {{}} b' } } }).text_tpl).toEqual(['a {{}} b']);
	});

	it('attrs: href, properties, builder-id, style, class (in that order)', () => {
		const p = plan();
		const c = p.compile({
			'@type': EL,
			id: 'builder-o',
			href: '/h',
			class: 'k',
			properties: { title: 't', class: 'pc', 'data-x': '1' },
			style: { color: 'red', marginTop: '1px', n: 5 as unknown as string }
		});
		expect(Object.keys(c.attrs)).toEqual(['href', 'title', 'class', 'data-x', 'builder-id', 'style']);
		expect(c.attrs).toEqual({ href: '/h', title: 't', class: 'builder-o builder-block k pc', 'data-x': '1', 'builder-id': 'builder-o', style: 'color: red; margin-top: 1px;' });
		const bare = p.compile({ '@type': EL });
		// (the official object always starts with `href`, undefined when the block has none)
		expect(Object.keys(bare.attrs)).toEqual(['href', 'builder-id', 'style', 'class']);
		expect(bare.attrs).toStrictEqual({ href: undefined, 'builder-id': undefined, style: '', class: 'builder-block' });
	});

	// official getBlockProperties, minus keys whose value is undefined (no attribute either way)
	const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
	const official_props = (b: BuilderBlock) => defined(getBlockProperties({ block: b as never, context: {} as never }) as Record<string, unknown>);

	it('attrs match official getBlockProperties (seeded sweep)', () => {
		const r = mulberry32(5);
		const STYLE_KEYS = ['color', 'marginTop', 'WebkitTransform', 'zIndex', 'backgroundColor', '--custom', 'a1B', 'ABc', ''];
		for (let i = 0; i < 400; i++) {
			const b: BuilderBlock = { '@type': EL };
			if (r() < 0.8) b.id = pick(r, ['builder-x', '', 'builder-</style>', 'id with space']);
			if (r() < 0.3) b.href = pick(r, ['/a', '', 'https://x.y/?a=1&b="2"']);
			if (r() < 0.3) b.class = pick(r, ['c1', '', 'c1 c2']);
			if (r() < 0.5) {
				const props: Record<string, string> = {};
				for (const k of ['title', 'class', 'data-a', 'builder-id', 'style', 'aria-label']) if (r() < 0.3) props[k] = pick(r, ['v', '', '&"<']);
				if (b.href !== undefined && r() < 0.3) props.href = '/p';
				b.properties = props;
			}
			if (r() < 0.6) {
				const style: Record<string, unknown> = {};
				for (const k of STYLE_KEYS) if (r() < 0.3) style[k] = pick(r, ['1px', 'red', '', 0, null, 'a;b', '</style>']);
				b.style = style;
			}
			const ours = plan().compile(b).attrs;
			const official = official_props(b);
			expect(defined(ours), JSON.stringify(b)).toEqual(official);
			expect(Object.keys(defined(ours))).toEqual(Object.keys(official));
			expect(ours.style).toBe(style_attr(b.style));
		}
	});

	// Regression: official getBlockProperties starts the object with `href: block.href` (even when
	// undefined), so a `properties.href` sits FIRST among the attributes; ours put it where `properties`
	// had it (`<a target=… href=…>` vs the official `<a href=… target=…>`).
	it('attribute order with properties.href and no block.href matches the official SDK', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-ho', properties: { target: '_blank', href: '/x' } };
		expect(Object.keys(defined(plan().compile(b).attrs))).toEqual(Object.keys(official_props(b)));
	});

	it('actions: lowercased, own props only, compiled as statements', () => {
		const p = plan();
		const actions = Object.create({ inherited: 'x' });
		actions.Click = 'state.a = 1';
		actions.mouseEnter = 'return 5';
		const c = p.compile({ '@type': EL, actions });
		expect(c.actions!.map(([e, code]) => [e, code])).toEqual([
			['click', 'state.a = 1'],
			['mouseenter', 'return 5']
		]);
		expect(typeof c.actions![0][2]).toBe('function');
		expect(p.compile({ '@type': EL, actions: {} }).actions).toBeNull();
		expect(p.compile({ '@type': EL }).actions).toBeNull();
		// the same event names as official getBlockActions (stripPrefix: the svelte `on:` removed)
		const official = Object.keys(getBlockActions({ block: { actions } as never, stripPrefix: true, localState: undefined, rootState: {}, rootSetState: undefined, context: {} } as never));
		expect(c.actions!.map(([e]) => e)).toEqual(official);
	});

	it('bindings: parsed paths; empty code -> fn null', () => {
		const c = plan().compile({ '@type': EL, bindings: { 'component.options.text': 'state.t', 'a[0].b': '  ', x: '' } });
		expect(c.bindings!.map((b) => [b.path, b.code, typeof b.fn])).toEqual([
			[['component', 'options', 'text'], 'state.t', 'function'],
			[['a', '0', 'b'], '  ', 'object'],
			[['x'], '', 'object']
		]);
		expect(c.bindings![1].fn).toBeNull();
		expect(plan().compile({ '@type': EL, bindings: {} }).bindings).toBeNull();
	});

	it('repeat: item_name defaults and the block without repeat', () => {
		const p = plan();
		const r = (repeat: BuilderBlock['repeat']) => p.compile({ '@type': EL, id: 'builder-r', repeat }).repeat;
		expect(r({ collection: 'state.products' })!.item_name).toBe('productsItem');
		expect(r({ collection: 'state.a.b.c' })!.item_name).toBe('cItem');
		expect(r({ collection: 'items' })!.item_name).toBe('itemsItem');
		expect(r({ collection: 'state.' })!.item_name).toBe('item');
		expect(r({ collection: 'state.x', itemName: 'it' })!.item_name).toBe('it');
		expect(r({ collection: 'state.x', itemName: '' })!.item_name).toBe('xItem');
		expect(r({ collection: '' })).toBeNull();
		expect(r(null)).toBeNull();
		const rep = r({ collection: 'state.list' })!;
		expect(rep.code).toBe('state.list');
		expect(typeof rep.fn).toBe('function');
		expect('repeat' in rep.block).toBe(false);
		expect(rep.block.id).toBe('builder-r');
	});

	it('is_link / tag / empty_tag', () => {
		const p = plan();
		const t = (b: Partial<BuilderBlock>) => {
			const c = p.compile({ '@type': EL, ...b });
			return [c.is_link, c.tag, c.empty_tag];
		};
		expect(t({})).toEqual([false, 'div', false]);
		expect(t({ tagName: 'a' })).toEqual([true, 'a', false]);
		expect(t({ tagName: 'span', href: '/x' })).toEqual([true, 'a', false]);
		expect(t({ tagName: 'img', properties: { href: '/x' } })).toEqual([true, 'a', false]);
		expect(t({ href: '' })).toEqual([false, 'div', false]);
		expect(t({ tagName: 'img' })).toEqual([false, 'img', true]);
		expect(t({ tagName: 'IMG' })).toEqual([false, 'IMG', true]);
		expect(t({ tagName: 'input' })).toEqual([false, 'input', true]);
		expect(t({ tagName: 'command' })).toEqual([false, 'command', false]);
		expect(t({ tagName: '' })).toEqual([false, 'div', false]);
		expect(t({ tagName: 'section' })).toEqual([false, 'section', false]);
		// compile_fresh: the tag is the one passed (the block as written), not the block's
		expect(p.compile_fresh({ '@type': EL, tagName: 'span' }, 'p').tag).toBe('p');
	});

	/** official Block `canShowBlock` (non-repeat) and BlockStyles `canShowBlock` */
	const official_visible = (b: Record<string, unknown>) => {
		const hide = 'hide' in b ? b.hide : false;
		const show = 'show' in b ? b.show : true;
		return !!(show && !hide);
	};
	const official_styles_visible = (b: Record<string, unknown>) => {
		if (checkIsDefined(b.hide)) return !b.hide;
		if (checkIsDefined(b.show)) return !!b.show;
		return true;
	};
	it('visible / styles visible: the official show/hide matrix', () => {
		const vals = ['absent', undefined, null, true, false, 0, 1, '', 'x'] as const;
		for (const show of vals)
			for (const hide of vals) {
				const b: Record<string, unknown> = { '@type': EL, id: 'builder-v', responsiveStyles: { large: { color: 'red' } } };
				if (show !== 'absent') b.show = show;
				if (hide !== 'absent') b.hide = hide;
				const c = plan().compile(b as BuilderBlock);
				expect(c.visible, JSON.stringify({ show, hide })).toBe(official_visible(b));
				expect(c.css !== '', JSON.stringify({ show, hide })).toBe(official_styles_visible(b));
			}
	});

	it('children: the block children or a shared frozen empty list', () => {
		const p = plan();
		const kids = [{ '@type': EL }] as BuilderBlock[];
		expect(p.compile({ '@type': EL, children: kids }).children).toBe(kids);
		const e = p.compile({ '@type': EL }).children;
		expect(e).toEqual([]);
		expect(Object.isFrozen(e)).toBe(true);
		expect(p.compile({ '@type': EL }).children).toBe(e);
	});
});

// ── block_css vs official BlockStyles css() ──────────────────────────────────────────────────────
type BP = { xsmall?: number; small?: number; medium?: number } | null | undefined;
/** official block-styles.svelte `css()`, with the content's breakpoints */
function official_css(block: BuilderBlock, breakpoints: BP): string {
	const styles = block.responsiveStyles;
	const sizes = getSizesForBreakpoints((breakpoints || {}) as never);
	const has_xsmall = Boolean(breakpoints?.xsmall);
	const className = block.id;
	if (!className) return '';
	const large = styles?.large ? createCssClass({ className, styles: styles.large }) : '';
	const medium = styles?.medium ? createCssClass({ className, styles: styles.medium, mediaQuery: getMaxWidthQueryForSize('medium', sizes) }) : '';
	const small = styles?.small ? createCssClass({ className, styles: styles.small, mediaQuery: getMaxWidthQueryForSize('small', sizes) }) : '';
	const xsmall =
		styles?.xsmall && has_xsmall ? createCssClass({ className, styles: styles.xsmall, mediaQuery: getMaxWidthQueryForSize('xsmall', sizes) }) : '';
	const hoverAnimation = block.animations && block.animations.find((item) => item.trigger === 'hover');
	let hover = '';
	if (hoverAnimation) {
		const hoverStyles = hoverAnimation.steps?.[1]?.styles || {};
		hover =
			createCssClass({
				className: `${className}:hover`,
				styles: {
					...hoverStyles,
					transition: `all ${hoverAnimation.duration}s ${camelToKebabCase(hoverAnimation.easing)}`,
					transitionDelay: hoverAnimation.delay ? `${hoverAnimation.delay}s` : '0s'
				} as never
			}) || '';
	}
	return [large, medium, small, xsmall, hover].join(' ');
}
/** ours: the official text, with a `</style` in it written `<\/style` (css_safe, deliberate), and
 *  no text at all where the official one is only the joining spaces (it renders no rule either). */
function expected_css(block: BuilderBlock, breakpoints: BP): string {
	const o = official_css(block, breakpoints);
	return o.trim() === '' ? '' : o.replace(/<\/(style)/gi, '<\\/$1');
}

describe('block_css', () => {
	const table: Array<[BuilderBlock, BP]> = [
		[{ id: 'builder-a', responsiveStyles: { large: { color: 'red', marginTop: '1px' } } }, undefined],
		[{ id: 'builder-a', responsiveStyles: { medium: { color: 'red' }, small: { color: 'blue' } } }, undefined],
		[{ id: 'builder-a', responsiveStyles: { medium: { color: 'red' }, small: { color: 'blue' }, xsmall: { color: 'g' } } }, { small: 500, medium: 800 }],
		[{ id: 'builder-a', responsiveStyles: { xsmall: { color: 'g' } } }, { xsmall: 300 }],
		[{ id: 'builder-a', responsiveStyles: { xsmall: { color: 'g' } } }, undefined],
		[{ id: 'builder-a', responsiveStyles: { small: { color: 'g' } } }, { xsmall: 300, small: 600, medium: 900 }],
		[{ id: 'builder-a', responsiveStyles: { small: { color: 'g' } } }, { small: 600 }],
		[{ id: 'builder-a', responsiveStyles: { large: {} } }, undefined],
		[{ id: 'builder-a', responsiveStyles: { large: { n: 1, u: undefined, o: {} } as never } }, undefined],
		[{ id: '', responsiveStyles: { large: { color: 'red' } } }, undefined],
		[{ responsiveStyles: { large: { color: 'red' } } }, undefined],
		[{ id: 'builder-a' }, undefined],
		[{ id: 'builder-a', animations: [{ trigger: 'hover', duration: 0.5, easing: 'easeInOut', delay: 0.2, steps: [{}, { styles: { opacity: '0.5', transition: 'x' } }] }] }, undefined],
		[{ id: 'builder-a', animations: [{ trigger: 'hover', duration: 1, easing: 'cubic-bezier(.37,.01,0,.98)', delay: 0 }] }, undefined],
		[{ id: 'builder-a', animations: [{ trigger: 'scrollInView', duration: 1, easing: 'ease' }] }, undefined],
		[{ id: 'builder-a', animations: [] }, undefined],
		[{ id: 'builder-a', responsiveStyles: { large: { content: '"</style><script>x</script>"' } } }, undefined],
		[{ id: 'builder-</style>', responsiveStyles: { large: { color: 'red' } } }, undefined],
		[{ id: 'builder-a', responsiveStyles: { large: { '😀Key': '😀', WebkitBoxShadow: 'none', '--MyVar': '1' } } }, null]
	];
	it.each(table.map((t, i) => [i, ...t] as const))('table %i', (_i, b, bp) => {
		const p = plan({ breakpoints: bp });
		expect(block_css(b, p)).toBe(expected_css(b, bp));
	});

	it('seeded sweep', () => {
		const r = mulberry32(2024);
		const KEYS = ['color', 'marginTop', 'WebkitTransform', 'zIndex', 'display', '--custom-var', 'aB1C', 'URL', '', '__proto__', 'constructor'];
		const VALUES: unknown[] = ['red', '1px', '', ' ', 'a;b}c{', '</style>', '</STYLE', '😀', 'x'.repeat(500), 0, null, undefined, true, {}, []];
		const EASINGS = ['ease', 'easeInOut', 'linear', 'cubic-bezier(0,0,1,1)', 'ABC', 'a1B'];
		const BPS: BP[] = [undefined, null, {}, { xsmall: 320 }, { small: 500, medium: 900 }, { xsmall: 200, small: 500, medium: 900 }, { small: 500 }, { xsmall: 0, small: 0, medium: 0 }];
		const styles = () => {
			const s: Record<string, unknown> = {};
			const n = Math.floor(r() * 4);
			for (let i = 0; i < n; i++) s[pick(r, KEYS)] = pick(r, VALUES);
			return s;
		};
		for (let i = 0; i < 500; i++) {
			const b: BuilderBlock = {};
			if (r() < 0.9) b.id = pick(r, ['builder-x', 'builder-y1', '', 'weird id', 'builder-</style>']);
			if (r() < 0.8) {
				const rs: Record<string, unknown> = {};
				for (const size of ['large', 'medium', 'small', 'xsmall']) if (r() < 0.5) rs[size] = styles();
				b.responsiveStyles = rs;
			}
			if (r() < 0.3) {
				const anims = [];
				const n = Math.floor(r() * 3);
				for (let k = 0; k < n; k++)
					anims.push({
						trigger: pick(r, ['hover', 'scrollInView', 'pageLoad']),
						duration: pick(r, [0, 0.5, 1, 2]),
						delay: pick(r, [0, 0.1, undefined]),
						easing: pick(r, EASINGS),
						steps: r() < 0.7 ? [{ styles: styles() }, { styles: r() < 0.8 ? (styles() as Record<string, string>) : undefined }] : undefined
					});
				b.animations = anims;
			}
			const bp = pick(r, BPS);
			expect(block_css(b, plan({ breakpoints: bp })), JSON.stringify({ b, bp })).toBe(expected_css(b, bp));
		}
	});

	it('the compiled css is block_css (when the styles show)', () => {
		const b: BuilderBlock = { '@type': EL, id: 'builder-cc', responsiveStyles: { large: { color: 'red' } } };
		const p = plan();
		expect(p.compile(b).css).toBe(block_css(b, p));
		expect(p.compile({ ...b, hide: true }).css).toBe('');
	});

	// Regression: a hover animation without `easing`: the official camelToKebabCase(undefined) gives '',
	// ours gave kebab(String(undefined)) = 'undefined' -> `transition: all 1s undefined;`.
	it('a hover animation without easing matches the official text', () => {
		const b: BuilderBlock = { id: 'builder-ne', animations: [{ trigger: 'hover', duration: 1 }] };
		expect(block_css(b, plan())).toBe(expected_css(b, undefined));
	});
});

// ── prepare: the one sheet, flags, localized owners ──────────────────────────────────────────────
const styled = (bid: string, color = 'red', extra: Partial<BuilderBlock> = {}): BuilderBlock => ({
	'@type': EL,
	id: bid,
	responsiveStyles: { large: { color } },
	...extra
});

describe('Plan.prepare: the one sheet', () => {
	it('static visible blocks with css; bound and hidden blocks excluded', () => {
		const a = styled(id('s'));
		const bound = styled(id('s'), 'blue', { bindings: { 'properties.title': 'state.t' } });
		const hidden = styled(id('s'), 'green', { hide: true });
		const nocss = { '@type': EL, id: id('s') } as BuilderBlock;
		const child = styled(id('s'), 'pink');
		const parent: BuilderBlock = { '@type': EL, id: id('s'), children: [child] };
		const p = plan({}, [a, bound, hidden, nocss, parent]);
		expect(p.sheet).toBe(`${p.compile(a).css} ${p.compile(child).css}`);
		expect(p.compile(a).in_sheet).toBe(true);
		expect(p.is_in_sheet(p.compile(a))).toBe(true);
		expect(p.compile(bound).in_sheet).toBeUndefined();
		expect(p.compile(hidden).css).toBe('');
		expect(p.compile(nocss).in_sheet).toBeUndefined();
		expect(p.is_in_sheet(p.compile(bound))).toBe(false);
	});

	it('blocks nested in options (a Columns column) are in it', () => {
		const inner = styled(id('col'));
		const p = plan({}, [{ '@type': EL, id: id('c'), component: { name: 'Columns', options: { columns: [{ blocks: [inner] }] } } }]);
		expect(p.sheet).toContain(`.${inner.id}`);
		expect(p.compile(inner).in_sheet).toBe(true);
	});

	it('a repeated block: its per-item copy counts as in the sheet', () => {
		const b = styled(id('rep'), 'red', { repeat: { collection: 'state.list' } });
		const p = plan({}, [b]);
		const c = p.compile(b);
		expect(c.in_sheet).toBe(true);
		const item = p.compile(c.repeat!.block);
		expect(item.in_sheet).toBeUndefined();
		expect(p.is_in_sheet(item)).toBe(true);
	});

	it('the same block object twice is compiled and sheeted once', () => {
		const b = styled(id('twice'));
		const p = plan({}, [b, b]);
		expect(p.sheet).toBe(p.compile(b).css);
	});

	it('undefined blocks and live plans: no sheet', () => {
		const p = plan();
		p.prepare(undefined);
		expect(p.sheet).toBe('');
		const live = plan({ live: true }, [styled(id('live'))]);
		expect(live.sheet).toBe('');
		expect(live.flags).toEqual({ personalization: false, ab: false, symbols: false });
	});

	it('duplicate ids with different styles: out of the sheet, each renders its own tag', () => {
		const dup = id('dup');
		const a = styled(dup, 'red');
		const b = styled(dup, 'blue');
		const other = styled(id('ok'));
		const p = plan({}, [a, b, other]);
		expect(p.sheet).toBe(p.compile(other).css);
		expect(p.compile(a).in_sheet).toBe(false);
		expect(p.compile(b).in_sheet).toBe(false);
		expect(p.is_in_sheet(p.compile(a))).toBe(false);
		// and out of any later plan's sheet too (an inline symbol's own plan)
		const again = plan({}, [a]);
		expect(again.sheet).toBe('');
	});

	it('duplicate ids with the same styles stay in the sheet', () => {
		const dup = id('same');
		const a = styled(dup, 'red');
		const b = styled(dup, 'red');
		const p = plan({}, [a, b]);
		expect(p.compile(a).in_sheet).toBe(true);
		expect(p.compile(b).in_sheet).toBe(true);
		expect(p.sheet).toContain(`.${dup}`);
	});

	it('a bound block sharing an id with a static one: both out', () => {
		const dup = id('bnd');
		const a = styled(dup, 'red');
		const b = styled(dup, 'red', { bindings: { 'properties.x': '1' } });
		const p = plan({}, [a, b]);
		expect(p.sheet).toBe('');
		expect(p.compile(a).in_sheet).toBe(false);
	});

	it('a repeated block whose id clashes leaves the repeat set', () => {
		const dup = id('rc');
		const a = styled(dup, 'red', { repeat: { collection: 'state.list' } });
		const b = styled(dup, 'blue');
		const p = plan({}, [a, b]);
		const c = p.compile(a);
		expect(p.is_in_sheet(p.compile(c.repeat!.block))).toBe(false);
	});

	it('duplicate ids where one has no css (hidden): the visible one is unsheeted only on a clash', () => {
		const dup = id('hc');
		const a = styled(dup, 'red');
		const b = styled(dup, 'red', { hide: true });
		const p = plan({}, [a, b]);
		expect(p.compile(a).in_sheet).toBe(false); // '' vs css differ
		expect(p.compile(b).in_sheet).toBeUndefined();
		expect(p.sheet).toBe('');
	});

	it('ids without a clash among many duplicates: sheet kept as built', () => {
		const ids = Array.from({ length: 5 }, () => id('m'));
		const blocks = [...ids, ...ids].map((x) => styled(x));
		const p = plan({}, blocks);
		expect(blocks.every((b) => p.compile(b).in_sheet)).toBe(true);
	});
});

describe('Plan.prepare: flags', () => {
	it('personalization, symbols', () => {
		expect(plan({}, [{ '@type': EL, component: { name: 'PersonalizationContainer' } }]).flags).toEqual({ personalization: true, ab: false, symbols: false });
		expect(plan({}, [{ '@type': EL, component: { name: 'Symbol' } }]).flags).toEqual({ personalization: false, ab: false, symbols: true });
		expect(plan({}, [{ '@type': EL, component: { name: 'Text' } }]).flags).toEqual({ personalization: false, ab: false, symbols: false });
	});

	it('ab: variations on a nested content (with data), not empty variations or no data', () => {
		const sym = (content: Record<string, unknown>): BuilderBlock[] => [{ '@type': EL, component: { name: 'Symbol', options: { symbol: { content } } } }];
		expect(plan({}, sym({ variations: { v1: { id: 'v1' } }, data: { blocks: [] } })).flags.ab).toBe(true);
		expect(plan({}, sym({ variations: {}, data: { blocks: [] } })).flags.ab).toBe(false);
		expect(plan({}, sym({ variations: { v1: {} } })).flags.ab).toBe(false);
	});

	it('ab: a nested content as an item of a block list', () => {
		const blocks = [{ '@type': EL, id: id('x') }, { variations: { v: {} }, data: {} }] as BuilderBlock[];
		expect(plan({}, blocks).flags.ab).toBe(true);
		const empty = [{ '@type': EL, id: id('x') }, { variations: {}, data: {} }, { variations: { v: {} } }, { variations: 'str', data: {} }] as BuilderBlock[];
		expect(plan({}, empty).flags.ab).toBe(false);
	});

	it('an Element met outside a block list is still found', () => {
		const inner = styled(id('lone'));
		const mixed = styled(id('mixed'));
		const p = plan({}, [{ '@type': EL, id: id('o'), component: { name: 'X', options: { single: inner, list: ['str', 1, null, mixed] } } }]);
		expect(p.compile(inner).in_sheet).toBe(true);
		expect(p.compile(mixed).in_sheet).toBe(true);
	});
});

describe('Plan.prepare: localized owners', () => {
	const loc = (fr: string) => ({ '@type': LOC, Default: 'def', fr });

	it('a block owning a localized value compiles resolved; one owning none keeps its options', () => {
		const owner: BuilderBlock = { '@type': EL, id: id('lo'), component: { name: 'Text', options: { text: loc('fr-text') } } };
		const plain: BuilderBlock = { '@type': EL, id: id('lp'), component: { name: 'Text', options: { text: 'same' } } };
		const p = plan({ locale: 'fr' }, [owner, plain]);
		expect(p.compile(owner).options.text).toBe('fr-text');
		expect(p.compile(owner).builder_block).not.toBe(owner);
		expect(p.compile(owner).builder_block.component!.options!.text).toBe('fr-text');
		expect(p.compile(plain).builder_block).toBe(plain);
		expect(owner.component!.options!.text).toEqual(loc('fr-text'));
	});

	it('a parent whose options hold a block with a localized value owns one too', () => {
		const nested: BuilderBlock = { '@type': EL, id: id('ln'), component: { name: 'Text', options: { text: loc('x') } } };
		const parent: BuilderBlock = { '@type': EL, id: id('lpar'), component: { name: 'Columns', options: { columns: [{ blocks: [nested] }] } } };
		const p = plan({ locale: 'fr' }, [parent]);
		expect(p.compile(parent).builder_block).not.toBe(parent);
	});

	it('a localized value as an item of a block list marks the list owner', () => {
		const b: BuilderBlock = { '@type': EL, id: id('li'), component: { name: 'X', options: { items: [{ '@type': EL, id: id('lii') }, loc('in-list')] } } };
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const p = plan({ locale: 'fr' }, [b]);
		expect((p.compile(b).options.items as unknown[])[1]).toBe('in-list');
	});

	it('no locale: Default (and the one-time warning)', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const b: BuilderBlock = { '@type': EL, id: id('ld'), component: { name: 'Text', options: { text: loc('fr') } } };
		const p = plan({}, [b]);
		expect(p.compile(b).options.text).toBe('def');
		void warn;
	});
});

describe('Plan.prepare: cycles in hand-built content', () => {
	it('a block that is its own child: found once, sheet built', () => {
		const b = styled(id('cyc')) as BuilderBlock;
		b.children = [b];
		const p = plan({}, [b]);
		expect(p.sheet).toBe(p.compile(b).css);
		expect(p.compile(b).in_sheet).toBe(true);
	});

	it('a cycle through options with flags and localized values', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const pc: BuilderBlock = { '@type': EL, id: id('pc'), component: { name: 'PersonalizationContainer', options: {} } };
		const sym: BuilderBlock = { '@type': EL, id: id('sy'), component: { name: 'Symbol', options: { symbol: {} } } };
		const loc_block: BuilderBlock = { '@type': EL, id: id('lc'), component: { name: 'Text', options: { text: { '@type': LOC, Default: 'D' } } } };
		const nested_content: Record<string, unknown> = { variations: { v: {} }, data: { blocks: [loc_block] } };
		pc.component!.options!.self = pc;
		pc.component!.options!.loop = [sym, nested_content];
		(sym.component!.options!.symbol as Record<string, unknown>).content = nested_content;
		nested_content.back = pc;
		const p = plan({}, [pc]);
		expect(p.flags).toEqual({ personalization: true, ab: true, symbols: true });
		expect(p.compile(loc_block).options.text).toBe('D');
	});
});

describe('Plan.prepare: inline symbols with other breakpoints (styled elsewhere)', () => {
	const symbol_block = (inner: BuilderBlock, slot: BuilderBlock, breakpoints?: BP): BuilderBlock => ({
		'@type': EL,
		id: id('sym'),
		component: {
			name: 'Symbol',
			options: { symbol: { data: { slot: [slot] }, content: { meta: breakpoints === undefined ? {} : { breakpoints }, data: { blocks: [inner] } } } }
		}
	});

	it('different breakpoints: the symbol blocks are not in this sheet', () => {
		const inner = styled(id('in'));
		const slot = styled(id('sl'));
		const page = styled(id('pg'));
		const p = plan({}, [page, symbol_block(inner, slot, { small: 500, medium: 800 })]);
		expect(p.sheet).toBe(p.compile(page).css);
		expect(p.compile(inner).in_sheet).toBeUndefined();
		expect(p.compile(slot).in_sheet).toBeUndefined();
	});

	it('the same breakpoints: in the sheet', () => {
		const inner = styled(id('in'));
		const slot = styled(id('sl'));
		const p = plan({ breakpoints: { small: 500, medium: 800 } }, [symbol_block(inner, slot, { small: 500, medium: 800 })]);
		expect(p.compile(inner).in_sheet).toBe(true);
		expect(p.compile(slot).in_sheet).toBe(true);
	});

	it('no breakpoints on either side: in the sheet; a symbol without content: nothing to exclude', () => {
		const inner = styled(id('in'));
		const p = plan({}, [symbol_block(inner, styled(id('sl')))]);
		expect(p.compile(inner).in_sheet).toBe(true);
		const lone = styled(id('lone'));
		const q = plan({ breakpoints: { small: 1, medium: 2 } }, [lone, { '@type': EL, component: { name: 'Symbol', options: { symbol: {} } } }, { '@type': EL, component: { name: 'Symbol' } }]);
		expect(q.compile(lone).in_sheet).toBe(true);
	});
});

// ── plan_for ─────────────────────────────────────────────────────────────────────────────────────
describe('plan_for', () => {
	const base = (): PlanOptions => ({ registry: registry_for(undefined), model: 'page', locale: undefined, breakpoints: undefined });

	it('cached per key object and options; prepared once', () => {
		const key = {};
		const blocks = [styled(id('pf'))];
		const a = plan_for(key, base(), blocks);
		expect(a.sheet).not.toBe('');
		expect(plan_for(key, base(), blocks)).toBe(a);
		expect(plan_for(key, base(), undefined)).toBe(a);
		expect(plan_for({}, base(), blocks)).not.toBe(a);
	});

	it('registry, model, locale, breakpoints (by value) and live are the key', () => {
		const key = {};
		const a = plan_for(key, base(), []);
		expect(plan_for(key, { ...base(), registry: registry_for([]) }, [])).not.toBe(a);
		expect(plan_for(key, { ...base(), model: 'section' }, [])).not.toBe(a);
		expect(plan_for(key, { ...base(), locale: 'fr' }, [])).not.toBe(a);
		expect(plan_for(key, { ...base(), locale: '' }, [])).toBe(a); // '' and undefined: the same key
		const bp = plan_for(key, { ...base(), breakpoints: { small: 1, medium: 2 } }, []);
		expect(bp).not.toBe(a);
		expect(plan_for(key, { ...base(), breakpoints: { small: 1, medium: 2 } }, [])).toBe(bp);
		expect(plan_for(key, { ...base(), breakpoints: { small: 1, medium: 3 } }, [])).not.toBe(bp);
		expect(plan_for(key, { ...base(), breakpoints: null }, [])).toBe(a);
		const live = plan_for(key, { ...base(), live: true }, []);
		expect(live).not.toBe(a);
		expect(live.live).toBe(true);
		expect(plan_for(key, { ...base(), live: false }, [])).toBe(a);
	});

	it('plan fields from the options', () => {
		const p = plan({ breakpoints: { xsmall: 300, small: 600, medium: 900 }, locale: 'fr', model: 'm' });
		expect([p.model, p.locale, p.has_xsmall, p.live]).toEqual(['m', 'fr', true, false]);
		expect(p.sizes.small.max).toBe(600);
		expect(p.sizes).toEqual(getSizesForBreakpoints({ xsmall: 300, small: 600, medium: 900 }));
		expect(plan().sizes).toEqual(getSizesForBreakpoints({}));
	});
});
