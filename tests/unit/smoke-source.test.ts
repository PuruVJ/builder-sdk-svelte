// The SDK renders from source in the test runner (vitest.config.ts compiles .svelte for the server).
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { Content } from '../../src/lib/index.js';

describe('rendering from source', () => {
	it('renders a Content with a Text block', () => {
		const { body } = render(Content, {
			props: {
				model: 'page',
				apiKey: 'k',
				canTrack: false,
				content: { id: 'c', data: { blocks: [{ '@type': '@builder.io/sdk:Element', id: 'builder-t', component: { name: 'Text', options: { text: '<p>hi</p>' } } }] } }
			}
		});
		expect(body).toContain('builder-content-id="c"');
		expect(body).toContain('<p>hi</p>');
	});
});
