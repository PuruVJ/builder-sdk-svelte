// @vitest-environment happy-dom
// internal/user-attributes.ts against the official helpers/user-attributes.ts service.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	get_user_attributes_cookie,
	on_user_attributes,
	set_can_track,
	set_user_attributes,
	USER_ATTRIBUTES_COOKIE_NAME
} from '../../src/lib/internal/user-attributes.js';
import {
	createUserAttributesService,
	USER_ATTRIBUTES_COOKIE_NAME as OFFICIAL_NAME
} from '../../node_modules/@builder.io/sdk-svelte/src/helpers/user-attributes';
import { clear_cookies } from './_dom.js';

beforeEach(() => {
	clear_cookies();
	set_can_track(true);
});
afterEach(() => {
	set_can_track(true);
	vi.restoreAllMocks();
});

describe('user attributes (official userAttributesService)', () => {
	it('the same cookie name', () => expect(USER_ATTRIBUTES_COOKIE_NAME).toBe(OFFICIAL_NAME));

	it('a sequence of sets gives the same cookie and the same notifications', () => {
		const steps: Record<string, unknown>[] = [{ a: 1 }, { b: 'x' }, { a: 2, c: [1, 2] }, {}, { 'ü': '✓' }, { a: null }];
		const ours: unknown[] = [];
		const official: unknown[] = [];
		const unsub = on_user_attributes((a) => ours.push(a));
		const service = createUserAttributesService();
		service.subscribeOnUserAttributesChange((a) => official.push(a));
		const ours_cookies: string[] = [];
		for (const s of steps) {
			set_user_attributes(s);
			ours_cookies.push(document.cookie);
		}
		clear_cookies();
		const official_cookies: string[] = [];
		for (const s of steps) {
			service.setUserAttributes(s);
			official_cookies.push(document.cookie);
		}
		expect(ours).toEqual(official);
		expect(ours_cookies).toEqual(official_cookies);
		expect(get_user_attributes_cookie()).toEqual(service.getUserAttributes());
		unsub();
	});

	it('canTrack false: nothing stored, nothing read, subscribers still told (as the official)', () => {
		document.cookie = `${USER_ATTRIBUTES_COOKIE_NAME}=${JSON.stringify({ old: 1 })}; path=/`;
		set_can_track(false);
		const service = createUserAttributesService();
		service.setCanTrack(false);
		const seen: unknown[] = [];
		const unsub = on_user_attributes((a) => seen.push(a));
		expect(get_user_attributes_cookie()).toEqual(service.getUserAttributes());
		expect(get_user_attributes_cookie()).toEqual({});
		set_user_attributes({ a: 1 });
		expect(seen).toEqual([{ a: 1 }]);
		expect(document.cookie).toBe(`${USER_ATTRIBUTES_COOKIE_NAME}=${JSON.stringify({ old: 1 })}`);
		unsub();
	});

	it('unsubscribing stops notifications; other subscribers stay', () => {
		const a = vi.fn();
		const b = vi.fn();
		const off_a = on_user_attributes(a);
		const off_b = on_user_attributes(b);
		off_a();
		set_user_attributes({ x: 1 });
		expect(a).not.toHaveBeenCalled();
		expect(b).toHaveBeenCalledWith({ x: 1 });
		off_b();
		off_b(); // twice is fine
	});

	it('a malformed cookie throws on read, as the official', () => {
		document.cookie = `${USER_ATTRIBUTES_COOKIE_NAME}=not-json; path=/`;
		expect(() => get_user_attributes_cookie()).toThrow();
		expect(() => createUserAttributesService().getUserAttributes()).toThrow();
	});
});
