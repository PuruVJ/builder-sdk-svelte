// PersonalizationContainer (official blocks/personalization-container): variants with queries, the
// default children, locale, previewingIndex, a block without an id, tracking on and off.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, lines, page, setup, teardown, text } from './harness.js';

beforeAll(setup);
afterAll(teardown);

const variant = (i: number, query: unknown = [{ property: 'device', operator: 'is', value: ['mobile'] }], rest: Record<string, unknown> = {}) => ({
	blocks: [text(`v${i}`, `<p>variant ${i}</p>`, { responsiveStyles: { large: { color: 'red' } } })],
	query,
	...rest
});
const defaults = [text('def', '<p>default</p>')];
const container = (options: Record<string, unknown>, rest: Record<string, unknown> = {}) =>
	page([comp('pc', 'PersonalizationContainer', options, { children: defaults, ...rest })]);

describe('PersonalizationContainer', () => {
	const table = {
		'no variants': { content: container({}) },
		'empty variants': { content: container({ variants: [] }) },
		'one variant': { content: container({ variants: [variant(0)] }) },
		'two variants': { content: container({ variants: [variant(0), variant(1, [{ property: 'urlPath', operator: 'is', value: '/x' }])] }) },
		'a variant without a query': { content: container({ variants: [variant(0, undefined)] }) },
		'a variant with dates': { content: container({ variants: [variant(0, [], { startDate: '2020-01-01', endDate: '2099-01-01' })] }) },
		'previewingIndex (editor only)': { content: container({ variants: [variant(0), variant(1)], previewingIndex: 1 }) },
		'block attributes and styles': {
			content: container({ variants: [variant(0)] }, { properties: { class: 'pc', 'data-x': 'y' }, responsiveStyles: { large: { padding: '1px' } } })
		},
		'no children': { content: page([comp('pc', 'PersonalizationContainer', { variants: [variant(0)] })]) },
		'a custom component in a variant': {
			content: container({ variants: [{ blocks: [comp('s', 'My Stub', { a: 1 })], query: [] }] }),
			customComponents: [{ name: 'My Stub' }]
		}
	};
	describe('tracking off (canTrack false): only the default', () => each_case(it, table));
	describe('tracking on: every variant hidden next to the default, with its scripts', () =>
		each_case(it, Object.fromEntries(Object.entries(table).map(([k, v]) => [k, { ...v, canTrack: true }]))));
	describe('with a locale', () =>
		each_case(it, {
			'locale, tracking on': { content: container({ variants: [variant(0, [{ property: 'locale', operator: 'is', value: 'fr' }])] }), canTrack: true, locale: 'fr' },
			'locale, tracking off': { content: container({ variants: [variant(0)] }), locale: 'de' }
		}));
	describe('a block without an id', () =>
		each_case(it, {
			'tracking on': { content: page([{ '@type': '@builder.io/sdk:Element', component: { name: 'PersonalizationContainer', options: { variants: [variant(0)] } }, children: defaults }]), canTrack: true },
			'tracking off': { content: page([{ '@type': '@builder.io/sdk:Element', component: { name: 'PersonalizationContainer', options: { variants: [variant(0)] } }, children: defaults }]) }
		}));

	it('ours: tracking on renders hidden variants, their scripts and the hiding style', () => {
		const c = check({ content: container({ variants: [variant(0), variant(1)] }), canTrack: true, nonce: 'abc' });
		const hidden = lines(c.ours, /data-variant-id="builder-pc-\d"/);
		expect(hidden).toHaveLength(2);
		for (const h of hidden) expect(h).toContain('hidden=""');
		expect(lines(c.ours, /data-variant-id="builder-pc-default"/)).toHaveLength(1);
		expect(c.html.ours).toContain('window.builderIoPersonalization(');
		expect(c.html.ours).toContain('window.updateVisibilityStylesScript(');
		expect(c.ours.css.some((r) => r.includes('div[data-variant-id="builder-pc-0"]'))).toBe(true);
		// the content-level helper functions, once
		expect(c.html.ours.match(/data-id=builderio-init-personalization-variants-fns/g)).toHaveLength(1);
	});

	it('ours: tracking off renders only the default children', () => {
		const c = check({ content: container({ variants: [variant(0), variant(1)] }) });
		expect(lines(c.ours, /data-variant-id/)).toEqual([lines(c.ours, /data-variant-id/)[0]]);
		expect(c.ours.tree).toContain('"default"');
		expect(c.ours.tree).not.toContain('"variant 0"');
		expect(c.html.ours).not.toContain('builderIoPersonalization(');
	});
});
