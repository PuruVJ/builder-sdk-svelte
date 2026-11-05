// internal/bridge.ts on the server.
import { describe, expect, it, vi } from 'vitest';
import { setup_browser_for_editing, subscribe_to_editor } from '../../src/lib/internal/bridge.js';
import { subscribeToEditor } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/subscribe-to-editor';

describe('bridge on the server', () => {
	it('subscribe_to_editor warns and returns a no-op', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const stop = subscribe_to_editor({ model: 'page', apiKey: 'k', callback: () => {} });
		expect(warn).toHaveBeenCalledWith('[Builder.io]: `subscribeToEditor` only works in the browser. It currently seems to be running on the server.');
		expect(stop()).toBeUndefined();
		warn.mockRestore();
	});
	it('(official bug: its `!isBrowser` tests the function, so on the server it reaches `window` and throws)', () => {
		expect(() => subscribeToEditor({ model: 'page', apiKey: 'k', callback: () => {} })).toThrow(ReferenceError);
	});
	it('setup_browser_for_editing is a no-op', () => {
		expect(() => setup_browser_for_editing({ modelName: 'page', apiKey: 'k' })).not.toThrow();
	});
});
