// @vitest-environment happy-dom
// src/lib/index.ts in the browser: track, _processContentResult, subscribeToEditor.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sdk from '../../src/lib/index.js';
import { track as official_track } from '../../node_modules/@builder.io/sdk-svelte/src/functions/track/index';
import { _processContentResult } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-content/index';
import { load_bridge } from '../../src/lib/internal/live.js';
import { clear_cookies, install_local_storage } from './_dom.js';

let fetch_spy: ReturnType<typeof vi.fn>;
beforeEach(() => {
	clear_cookies();
	install_local_storage();
	fetch_spy = vi.fn(async () => new Response('{}'));
	vi.stubGlobal('fetch', fetch_spy);
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('public API in the browser', () => {
	it('track: canTrack forced on, the official POST', async () => {
		document.cookie = 'builderSessionId=s; path=/';
		localStorage.setItem('builderVisitorId', 'v');
		await sdk.track({ type: 'conversion', apiKey: 'k', contentId: 'c', canTrack: false } as never);
		await official_track({ type: 'conversion', apiKey: 'k', contentId: 'c', canTrack: false } as never);
		expect(fetch_spy).toHaveBeenCalledTimes(2);
		expect(fetch_spy.mock.calls[0]).toEqual(fetch_spy.mock.calls[1]);
	});

	it('_processContentResult: the A/B variation applied, as the official', async () => {
		document.cookie = 'builder.tests.c=v; path=/';
		const content = () => ({ results: [{ id: 'c', data: { a: 0 }, variations: { v: { id: 'v', testRatio: 1, data: { a: 1 } } } }] });
		const opts = { model: 'page', apiKey: 'k' };
		const ours = await sdk._processContentResult(opts as never, content() as never);
		expect(ours).toEqual(await _processContentResult(opts as never, content() as never));
		expect(ours[0].data).toEqual({ a: 1 });
		expect(await sdk._processContentResult({ ...opts, canTrack: false } as never, content() as never)).toEqual(content().results);
	});

	it('subscribeToEditor: subscribes once the bridge has loaded; stop unsubscribes', async () => {
		const bridge = await load_bridge();
		const stop_inner = vi.fn();
		const sub = vi.spyOn(bridge, 'subscribe_to_editor').mockReturnValue(stop_inner);
		const args = { model: 'page', apiKey: 'k', callback: () => {} };
		const stop = sdk.subscribeToEditor(args);
		await load_bridge();
		await Promise.resolve();
		expect(sub).toHaveBeenCalledWith(args);
		stop();
		expect(stop_inner).toHaveBeenCalledOnce();
	});

	it('subscribeToEditor: stopped before the bridge loads, it never subscribes', async () => {
		const bridge = await load_bridge();
		const sub = vi.spyOn(bridge, 'subscribe_to_editor');
		const stop = sdk.subscribeToEditor({ model: 'page', apiKey: 'k', callback: () => {} });
		stop();
		await load_bridge();
		await Promise.resolve();
		expect(sub).not.toHaveBeenCalled();
	});

	it('subscribeToEditor end to end: content updates of the model reach the callback', async () => {
		const cb = vi.fn();
		vi.spyOn(window, 'postMessage').mockImplementation(() => {});
		const stop = sdk.subscribeToEditor({ model: 'page', apiKey: 'k', callback: cb });
		await load_bridge();
		await Promise.resolve();
		window.dispatchEvent(new MessageEvent('message', { origin: 'https://builder.io', data: { type: 'builder.contentUpdate', data: { modelName: 'page', data: { id: 'x' } } } }));
		stop();
		window.dispatchEvent(new MessageEvent('message', { origin: 'https://builder.io', data: { type: 'builder.contentUpdate', data: { modelName: 'page', data: { id: 'y' } } } }));
		expect(cb.mock.calls).toEqual([[{ id: 'x' }, undefined]]);
	});
});
