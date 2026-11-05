// Core:Button (official blocks/button/button.svelte): text, link, openLinkInNewTab, the block's
// attributes, and a linkComponent — through both SDKs and live.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, lines, page, setup, teardown } from './harness.js';

beforeAll(setup);
afterAll(teardown);

const button = (options: Record<string, unknown>, rest: Record<string, unknown> = {}) =>
	page([comp('btn', 'Core:Button', options, rest)]);

describe('Core:Button', () => {
	each_case(it, {
		'text only': { content: button({ text: 'Click me' }) },
		'no text': { content: button({}) },
		'html in text is escaped': { content: button({ text: '<b>bold</b> & co' }) },
		link: { content: button({ text: 'Go', link: 'https://example.com/a?b=1&c=2' }) },
		'link, new tab': { content: button({ text: 'Go', link: '/x', openLinkInNewTab: true }) },
		'new tab without link': { content: button({ text: 'Go', openLinkInNewTab: true }) },
		'empty link': { content: button({ text: 'Go', link: '' }) },
		'block attributes (class, data, aria)': {
			content: button({ text: 'Go' }, { properties: { class: 'extra', 'data-x': '1', 'aria-label': 'go' } })
		},
		'block attributes on a link button': {
			content: button({ text: 'Go', link: '/x' }, { properties: { class: 'extra', title: 'T' } })
		},
		'styles and responsive styles': {
			content: button(
				{ text: 'Go' },
				{ responsiveStyles: { large: { color: 'red', padding: '4px' }, medium: { color: 'blue' }, small: { color: 'green' } } }
			)
		},
		'actions on the block (no handler in SSR)': {
			content: button({ text: 'Go' }, { actions: { click: 'state.n = 1' } })
		},
		'link through a linkComponent': { content: button({ text: 'Go', link: '/x', openLinkInNewTab: true }), link: true },
		'no link, with a linkComponent (a button)': { content: button({ text: 'Go' }), link: true },
		'bound text': {
			content: page([comp('btn', 'Core:Button', {}, { bindings: { 'component.options.text': 'state.label' } })], { state: { label: 'Bound' } })
		},
		'bound link': {
			content: page([comp('btn', 'Core:Button', { text: 'x' }, { bindings: { 'component.options.link': 'state.href' } })], { state: { href: '/to' } })
		}
	});
});

describe('Core:Button (ours)', () => {
	it('renders the shapes the official markup has', () => {
		const plain = check({ content: button({ text: 'Go' }) }).ours;
		expect(lines(plain, /<button/)[0]).toMatch(/class="[^"]*builder-button/);
		expect(lines(plain, /<button/)[0]).toContain('role="button"');
		const linked = check({ content: button({ text: 'Go', link: '/x', openLinkInNewTab: true }) }).ours;
		expect(lines(linked, /<a /).some((l) => l.includes('href="/x"') && l.includes('target="_blank"') && l.includes('role="link"'))).toBe(true);
		const custom = check({ content: button({ text: 'Go', link: '/x' }), link: true }).ours;
		expect(lines(custom, /data-link-component/).some((l) => l.includes('href="/x"'))).toBe(true);
	});
});
