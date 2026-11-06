// @vitest-environment happy-dom
// internal/env.ts in the browser (top window and framed) against the official functions/is-*.ts.
import { afterEach, describe, expect, it } from 'vitest';
import { is_browser, is_editing, is_iframe, is_previewing } from '../../src/lib/internal/env.js';
import { isEditing } from '../../node_modules/@builder.io/sdk-svelte/src/functions/is-editing';
import { isPreviewing } from '../../node_modules/@builder.io/sdk-svelte/src/functions/is-previewing';
import { isIframe } from '../../node_modules/@builder.io/sdk-svelte/src/functions/is-iframe';
import { in_iframe, set_url } from './_dom.js';
import { SEARCHES } from './_searches.js';

afterEach(() => set_url('/'));

const PAGES = ['/', '/?builder.preview=page', '/?builder.frameEditing=page', '/?builder.frameEditing=page&builder.preview=page', '/?q=builder.preview'];

describe('env in the browser', () => {
	it('is a browser', () => expect(is_browser()).toBe(true));
	for (const framed of [false, true])
		for (const page of PAGES)
			it(`${framed ? 'framed' : 'top'} ${page}`, async () => {
				set_url(page);
				const check = () => {
					expect(is_iframe()).toBe(isIframe());
					expect(is_iframe()).toBe(framed);
					for (const search of SEARCHES) {
						expect(is_previewing(search as never)).toBe(isPreviewing(search as never));
						expect(is_editing(search as never)).toBe(isEditing(search as never));
					}
				};
				if (framed) await in_iframe(check);
				else check();
			});
});
