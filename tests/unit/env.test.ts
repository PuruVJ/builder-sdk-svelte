// internal/env.ts on the server against the official functions/is-*.ts.
import { describe, expect, it } from 'vitest';
import { is_browser, is_editing, is_iframe, is_previewing, search_string } from '../../src/lib/internal/env.js';
import { isEditing } from '../../node_modules/@builder.io/sdk-svelte/src/functions/is-editing';
import { isPreviewing } from '../../node_modules/@builder.io/sdk-svelte/src/functions/is-previewing';
import { isBrowser } from '../../node_modules/@builder.io/sdk-svelte/src/functions/is-browser';
import { isIframe } from '../../node_modules/@builder.io/sdk-svelte/src/functions/is-iframe';
import { getSearchString } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/search/search';
import { SEARCHES } from './_searches.js';


describe('env on the server', () => {
	it('is not a browser, not framed', () => {
		expect(is_browser()).toBe(isBrowser());
		expect(is_browser()).toBe(false);
		expect(is_iframe()).toBe(isIframe());
	});
	it.each(SEARCHES.map((s, i) => [i, s]))('is_previewing / is_editing #%i', (_i, search) => {
		expect(is_previewing(search as never)).toBe(isPreviewing(search as never));
		expect(is_editing(search as never)).toBe(isEditing(search as never));
	});
	it.each(SEARCHES.filter((s) => s !== undefined).map((s, i) => [i, s]))('search_string #%i', (_i, search) => {
		expect(search_string(search as never)).toBe(getSearchString(search as never));
	});
});
