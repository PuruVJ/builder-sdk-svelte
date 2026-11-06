// @vitest-environment happy-dom
// internal/live.ts in the browser: coalesce per frame, is_authoring.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coalesce, is_authoring } from '../../src/lib/internal/live.js';
import { in_iframe, set_url } from './_dom.js';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	set_url('/');
});

describe('coalesce', () => {
	it('a burst flushes once on the next frame, and the fallback timer is cleared', () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
		const flush = vi.fn();
		const c = coalesce(flush);
		for (let i = 0; i < 5; i++) c.schedule();
		vi.advanceTimersToNextFrame();
		expect(flush).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(100);
		expect(flush).toHaveBeenCalledOnce();
	});
	it('frames not running (hidden tab): the timeout flushes and cancels the frame', () => {
		const raf = vi.fn(() => 42);
		const caf = vi.fn();
		vi.stubGlobal('requestAnimationFrame', raf);
		vi.stubGlobal('cancelAnimationFrame', caf);
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const flush = vi.fn();
		const c = coalesce(flush);
		c.schedule();
		vi.advanceTimersByTime(50);
		expect(flush).toHaveBeenCalledOnce();
		expect(caf).toHaveBeenCalledWith(42);
		// the stale frame callback, if it ever ran, does nothing
		(raf.mock.calls[0] as unknown as [() => void])[0]();
		expect(flush).toHaveBeenCalledOnce();
	});
	it('cancel cancels the frame and the timer', () => {
		const caf = vi.fn();
		vi.stubGlobal('requestAnimationFrame', () => 7);
		vi.stubGlobal('cancelAnimationFrame', caf);
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		const flush = vi.fn();
		const c = coalesce(flush);
		c.schedule();
		c.cancel();
		expect(caf).toHaveBeenCalledWith(7);
		vi.advanceTimersByTime(100);
		expect(flush).not.toHaveBeenCalled();
	});
});

describe('is_authoring', () => {
	it('a visitor: no', () => expect(is_authoring()).toBe(false));
	it('a preview link: yes', () => {
		set_url('/?builder.preview=page');
		expect(is_authoring()).toBe(true);
	});
	it('the editor (framed, builder.frameEditing): yes; not framed: no', async () => {
		set_url('/?builder.frameEditing=page');
		expect(is_authoring()).toBe(false);
		expect(await in_iframe(() => is_authoring())).toBe(true);
	});
});
