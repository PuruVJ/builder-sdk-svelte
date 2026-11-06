// Columns (official blocks/columns/columns.svelte): column count, widths, space, stackColumnsAt,
// reverseColumnsWhenStacked, column links, nested blocks, the content's own breakpoints.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, el, lines, page, setup, teardown, text } from './harness.js';

beforeAll(setup);
afterAll(teardown);

const col = (i: number, rest: Record<string, unknown> = {}) => ({ blocks: [text(`c${i}t`, `<p>col ${i}</p>`)], ...rest });
const columns = (options: Record<string, unknown>, rest: Record<string, unknown> = {}, data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
	page([comp('cols', 'Columns', options, rest)], data, extra);

describe('Columns', () => {
	each_case(it, {
		'no columns option': { content: columns({}) },
		'empty columns': { content: columns({ columns: [] }) },
		'one column': { content: columns({ columns: [col(0)] }) },
		'two columns': { content: columns({ columns: [col(0), col(1)] }) },
		'three columns': { content: columns({ columns: [col(0), col(1), col(2)] }) },
		'five columns': { content: columns({ columns: [0, 1, 2, 3, 4].map((i) => col(i)) }) },
		'widths': { content: columns({ columns: [col(0, { width: 30 }), col(1, { width: 70 })] }) },
		'some widths': { content: columns({ columns: [col(0, { width: 25 }), col(1), col(2)] }) },
		'width 0 falls back': { content: columns({ columns: [col(0, { width: 0 }), col(1)] }) },
		'space 0': { content: columns({ space: 0, columns: [col(0), col(1)] }) },
		'space 40': { content: columns({ space: 40, columns: [col(0), col(1), col(2)] }) },
		'space as a string (ignored)': { content: columns({ space: '15', columns: [col(0), col(1)] }) },
		'stack never': { content: columns({ stackColumnsAt: 'never', columns: [col(0), col(1)] }) },
		'stack tablet': { content: columns({ stackColumnsAt: 'tablet', columns: [col(0), col(1)] }) },
		'stack mobile': { content: columns({ stackColumnsAt: 'mobile', columns: [col(0), col(1)] }) },
		'reverse when stacked': { content: columns({ reverseColumnsWhenStacked: true, columns: [col(0), col(1)] }) },
		'reverse, stack mobile': { content: columns({ reverseColumnsWhenStacked: true, stackColumnsAt: 'mobile', columns: [col(0), col(1)] }) },
		'reverse, stack never': { content: columns({ reverseColumnsWhenStacked: true, stackColumnsAt: 'never', columns: [col(0), col(1)] }) },
		'a column link': { content: columns({ columns: [col(0, { link: '/one' }), col(1)] }) },
		'every column a link': { content: columns({ columns: [col(0, { link: '/one' }), col(1, { link: 'https://x.test/two' })] }) },
		'column links through a linkComponent': { content: columns({ columns: [col(0, { link: '/one' }), col(1)] }), link: true },
		'a column with no blocks': { content: columns({ columns: [{}, col(1)] }) },
		'a column with empty blocks': { content: columns({ columns: [{ blocks: [] }, col(1)] }) },
		'nested blocks (a block with children in a column)': {
			content: columns({
				columns: [{ blocks: [el('box', { children: [text('in1', 'a'), text('in2', 'b')], responsiveStyles: { large: { padding: '3px' } } })] }, col(1)]
			})
		},
		'nested columns': {
			content: columns({ columns: [{ blocks: [comp('inner', 'Columns', { columns: [col(5), col(6)], space: 10 })] }, col(1)] })
		},
		'a custom component in a column': {
			content: columns({ columns: [{ blocks: [comp('x', 'My Stub', { title: 'hi' })] }, col(1)] }),
			customComponents: [{ name: 'My Stub' }]
		},
		'custom breakpoints': {
			content: columns({ columns: [col(0), col(1)] }, { responsiveStyles: { large: { gap: '1px' }, medium: { gap: '2px' }, small: { gap: '3px' } } }, {}, { meta: { breakpoints: { small: 500, medium: 900 } } })
		},
		'custom breakpoints, only medium': {
			content: columns({ columns: [col(0), col(1)] }, {}, {}, { meta: { breakpoints: { medium: 1100 } } })
		},
		'custom breakpoints, invalid (small above medium)': {
			content: columns({ columns: [col(0), col(1)] }, {}, {}, { meta: { breakpoints: { small: 1200, medium: 600 } } })
		},
		'styled columns block': {
			content: columns({ columns: [col(0), col(1)] }, { responsiveStyles: { large: { marginTop: '10px' } }, properties: { class: 'mine' } })
		},
		'bound columns': {
			content: columns({ columns: [col(0)] }, { bindings: { 'component.options.space': 'state.gap' } }, { state: { gap: 7 } })
		},
		'a column block with a binding': {
			content: columns({ columns: [{ blocks: [text('bt', 'x', { bindings: { 'component.options.text': 'state.t' } })] }] }, {}, { state: { t: 'bound!' } })
		}
	});

	it('ours: the column CSS and the stacking variables', () => {
		const c = check({ content: columns({ stackColumnsAt: 'mobile', space: 10, columns: [col(0, { width: 40 }), col(1, { width: 60 })] }) });
		const wrap = lines(c.ours, /builder-columns/)[0];
		expect(wrap).toContain('--flex-dir:column');
		expect(wrap).toContain('--flex-dir-tablet:row');
		const cols = lines(c.ours, /class="builder-column"/);
		expect(cols).toHaveLength(2);
		expect(cols[0]).toContain('width: calc(40% - 4px)');
		expect(cols[1]).toContain('margin-left: 10px');
		expect(c.ours.css.some((r) => r.includes('@media (max-width:991px)') && r.includes('.builder-cols-breakpoints'))).toBe(true);
	});

	it('ours: custom breakpoints move the column media queries', () => {
		const c = check({ content: columns({ columns: [col(0), col(1)] }, {}, {}, { meta: { breakpoints: { small: 500, medium: 900 } } }) });
		expect(c.ours.css.some((r) => r.startsWith('@media (max-width:900px){.builder-cols-breakpoints'))).toBe(true);
		expect(c.ours.css.some((r) => r.startsWith('@media (max-width:500px){.builder-cols-breakpoints'))).toBe(true);
	});

	it('ours: a column link is an <a href> (or the link component)', () => {
		const a = check({ content: columns({ columns: [col(0, { link: '/one' })] }) });
		expect(lines(a.ours, /<a /)[0]).toContain('href="/one"');
		const b = check({ content: columns({ columns: [col(0, { link: '/one' })] }), link: true });
		expect(lines(b.ours, /data-link-component/)[0]).toContain('href="/one"');
	});
});
