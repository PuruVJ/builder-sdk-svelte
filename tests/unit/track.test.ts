// internal/track.ts on the server: nothing is sent, the user attributes have no location.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { get_cookie, get_user_attributes, set_cookie, track, SDK_VERSION } from '../../src/lib/internal/track.js';
import { getUserAttributes } from '../../node_modules/@builder.io/sdk-svelte/src/functions/track/helpers';
import { SDK_VERSION as OFFICIAL_VERSION } from '../../node_modules/@builder.io/sdk-svelte/src/constants/sdk-version';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('track on the server', () => {
	it('sends nothing, even with canTrack', async () => {
		const f = vi.fn();
		vi.stubGlobal('fetch', f);
		await track({ type: 'impression', apiKey: 'k', canTrack: true });
		expect(f).not.toHaveBeenCalled();
	});
	it('still reports a missing API key', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		await track({ type: 'impression', apiKey: undefined as never, canTrack: true });
		expect(err).toHaveBeenCalledOnce();
	});
	it('cookies are a no-op without a document', () => {
		expect(get_cookie('a', true)).toBeUndefined();
		expect(() => set_cookie('a', '1', true)).not.toThrow();
	});
	it('user attributes: no location, the device from the UA (official, minus its warning)', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(get_user_attributes()).toEqual(getUserAttributes());
		expect(get_user_attributes()).toEqual({ urlPath: undefined, host: undefined, device: 'desktop' });
		vi.stubGlobal('navigator', { userAgent: 'iPhone' });
		expect(get_user_attributes()).toEqual(getUserAttributes());
		vi.stubGlobal('navigator', undefined);
		expect(get_user_attributes()).toEqual(getUserAttributes());
		expect(warn).toHaveBeenCalled(); // (the official warns each time; ours does not)
	});
	it('reports the official SDK version', () => {
		expect(SDK_VERSION).toBe(OFFICIAL_VERSION);
	});
});
