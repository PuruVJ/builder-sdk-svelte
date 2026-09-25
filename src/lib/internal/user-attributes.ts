/** Personalization user attributes (official helpers/user-attributes.ts): a cookie + subscribers. */
import { is_browser } from './env.js';
import { get_cookie, set_cookie } from './track.js';

export const USER_ATTRIBUTES_COOKIE_NAME = 'builder.userAttributes';
type Attrs = Record<string, unknown>;

let can_track = true;
const subscribers = new Set<(attrs: Attrs) => void>();

export function get_user_attributes_cookie(): Attrs {
	if (!is_browser()) return {};
	return JSON.parse(get_cookie(USER_ATTRIBUTES_COOKIE_NAME, can_track) || '{}');
}

export function set_user_attributes(next: Attrs): void {
	if (!is_browser()) return;
	const attrs = { ...get_user_attributes_cookie(), ...next };
	set_cookie(USER_ATTRIBUTES_COOKIE_NAME, JSON.stringify(attrs), can_track);
	for (const cb of subscribers) cb(attrs);
}

export function on_user_attributes(cb: (attrs: Attrs) => void): () => void {
	subscribers.add(cb);
	return () => subscribers.delete(cb);
}

/** official `getDefaultCanTrack` side effect: the service follows the last `canTrack` seen. */
export function set_can_track(value: boolean): void {
	can_track = value;
}
