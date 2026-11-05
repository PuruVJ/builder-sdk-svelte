/**
 * The minimal contents the fuzz test (tests/fuzz.test.ts) shrank its failures to, one per divergence
 * class it found, kept as a fixed regression list: each must render the same through both SDKs (and
 * the same with PLAIN on and off). The fixtures in fixtures/gen/feat-fuzz-*.json cover the same
 * classes in a fuller shape; these are the exact shapes that failed.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { check } from './fuzz/check.js';
import { normalize } from './normalize.js';
import type { Spec } from './fuzz/gen.js';
// @ts-ignore built by `pnpm bench:build`
import { render_content, set_echo } from '../bench/dist/entry.js';

const E = '@builder.io/sdk:Element';
const LOC = '@builder.io/core:LocalizedValue';

const CASES: Array<[string, Spec]> = [
	['a bound tagName does not change the tag', { content: { data: { blocks: [{ '@type': E, bindings: { tagName: '"span"' } }] } } }],
	['data.blocks does not replace the content blocks', { content: { data: { blocks: [{ '@type': E, id: 'A' }] } }, data: { blocks: [] } }],
	['data.blocks fills in missing content blocks', { content: { data: {} }, data: { blocks: [{ '@type': E, id: 'B' }] } }],
	[
		'the data prop wins over what jsCode wrote',
		{
			content: {
				data: {
					blocks: [{ '@type': E, component: { name: 'Text', options: { text: '<p>Hi {{state.title}}</p>' } } }],
					jsCode: 'state.title = "js:" + (state.title || "")'
				}
			},
			data: { title: 'x' }
		}
	],
	[
		'a container receives nested blocks with localized values resolved',
		{
			content: { data: { blocks: [{ '@type': E, component: { name: 'Fuzz Card', options: { items: [{ '@type': E, component: { options: { text: { '@type': LOC, Default: 'd', 'fr-FR': 'f' } } } }] } } }] } },
			locale: 'fr-FR'
		}
	],
	[
		'duplicate id: an unrendered block does not style a rendered one',
		{
			content: {
				data: {
					blocks: [
						{ '@type': E, id: 'builder-45-1' },
						{ '@type': E, hide: 1, children: [{ '@type': E, id: 'builder-45-1', responsiveStyles: { large: { color: 'red' } } }] }
					]
				}
			}
		}
	],
	[
		'duplicate id across an inline symbol',
		{
			content: {
				data: {
					blocks: [
						{
							'@type': E,
							id: 'builder-72-1',
							component: {
								name: 'Symbol',
								options: { symbol: { content: { data: { blocks: [{ '@type': E, component: { options: { items: [{ detail: [{ '@type': E, id: 'builder-72-1', responsiveStyles: { large: { color: 'red' } } }] }] } } }] } } } }
							}
						}
					]
				}
			}
		}
	],
	[
		'duplicate id across a localized inline symbol (its content renders as a copy)',
		{
			content: {
				data: {
					blocks: [
						{
							'@type': E,
							id: 'builder-5d7-2',
							component: {
								name: 'Symbol',
								options: {
									symbol: {
										content: {
											data: {
												blocks: [
													{
														'@type': E,
														component: { name: 'Form:TextArea' },
														children: [
															{
																'@type': E,
																id: 'builder-5d7-2',
																component: { options: { items: [{ '@type': E, component: { options: { title: { '@type': LOC } } } }] } },
																responsiveStyles: { medium: { color: 'red' } }
															}
														]
													}
												]
											}
										}
									}
								}
							}
						}
					]
				}
			}
		}
	],
	[
		'an inline symbol is styled with its own breakpoints',
		{
			content: {
				data: { blocks: [{ '@type': E, component: { name: 'Symbol', options: { symbol: { content: { data: { blocks: [{ '@type': E, id: 'builder-bf-8e', responsiveStyles: { medium: { color: 'red' } } }] } } } } } }] },
				meta: { breakpoints: { small: 500, medium: 900 } }
			}
		}
	],
	[
		"a symbol's slot blocks are styled with the symbol's breakpoints",
		{
			content: {
				data: {
					blocks: [
						{
							'@type': E,
							component: {
								name: 'Symbol',
								options: {
									symbol: {
										content: { data: { blocks: [{ '@type': E, component: { name: 'Slot', options: { name: 'slotA' } } }] } },
										data: { slotA: [{ '@type': E, id: 'builder-291a-47', responsiveStyles: { xsmall: { color: 'red' } } }] }
									}
								}
							}
						}
					]
				},
				meta: { breakpoints: { xsmall: 400 } }
			}
		}
	],
	[
		'a personalization container without an id hides its variants by "undefined-N"',
		{ content: { data: { blocks: [{ '@type': E, component: { name: 'PersonalizationContainer', options: { variants: [{}] } } }] } }, props: { canTrack: true } }
	],
	['a textarea block (raw text) compares as markup', { content: { data: { blocks: [{ '@type': E, tagName: 'textarea', children: [{ '@type': E }] }] } } }]
];

beforeAll(() => {
	set_echo(true);
	for (const m of ['log', 'warn', 'error'] as const) vi.spyOn(console, m).mockImplementation(() => {});
	vi.stubGlobal('fetch', () => Promise.reject(new Error('no network')));
});

describe('fuzz regressions: minimal shapes that once diverged', () => {
	for (const [name, spec] of CASES)
		it(name, () => {
			const r = check(spec);
			expect(r.official_error).toBeUndefined();
			expect(r.failure).toBeNull();
		});
});

describe('a style value cannot close its style tag (the official SDK lets it inject markup)', () => {
	it('</style> in responsive, inline-sheet and own-tag styles stays CSS', () => {
		const html = render_content('ours', {
			content: {
				id: 'c',
				data: {
					blocks: [
						{ '@type': E, id: 'builder-a', responsiveStyles: { large: { color: '</style><b id="injected">x</b>' } } },
						{ '@type': E, id: 'builder-b', bindings: { 'style.color': '"red"' }, responsiveStyles: { small: { color: '</STYLE><i id="injected2">' } } }
					]
				}
			},
			model: 'page',
			apiKey: 'k',
			canTrack: false
		}).body;
		expect(html).not.toMatch(/<\/style><[bi] id="injected/i);
		expect(normalize(html).tree).not.toContain('injected');
	});
});
