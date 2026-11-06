// internal/user-attributes.ts on the server: no cookie, no notifications.
import { describe, expect, it, vi } from 'vitest';
import { get_user_attributes_cookie, on_user_attributes, set_user_attributes } from '../../src/lib/internal/user-attributes.js';
import { createUserAttributesService } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/user-attributes';

describe('user attributes on the server', () => {
	it('reads {} and sets nothing (no subscriber told), as the official', () => {
		const cb = vi.fn();
		const off = on_user_attributes(cb);
		const service = createUserAttributesService();
		const official_cb = vi.fn();
		service.subscribeOnUserAttributesChange(official_cb);
		set_user_attributes({ a: 1 });
		service.setUserAttributes({ a: 1 });
		expect(cb).not.toHaveBeenCalled();
		expect(official_cb).not.toHaveBeenCalled();
		expect(get_user_attributes_cookie()).toEqual(service.getUserAttributes());
		off();
	});
});
