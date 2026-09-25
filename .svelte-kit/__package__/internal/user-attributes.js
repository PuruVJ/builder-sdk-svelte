/** Personalization user attributes (official helpers/user-attributes.ts): a cookie + subscribers. */
import { is_browser } from './env.js';
import { get_cookie, set_cookie } from './track.js';
export const USER_ATTRIBUTES_COOKIE_NAME = 'builder.userAttributes';
let can_track = true;
const subscribers = new Set();
export function get_user_attributes_cookie() {
    if (!is_browser())
        return {};
    return JSON.parse(get_cookie(USER_ATTRIBUTES_COOKIE_NAME, can_track) || '{}');
}
export function set_user_attributes(next) {
    if (!is_browser())
        return;
    const attrs = { ...get_user_attributes_cookie(), ...next };
    set_cookie(USER_ATTRIBUTES_COOKIE_NAME, JSON.stringify(attrs), can_track);
    for (const cb of subscribers)
        cb(attrs);
}
export function on_user_attributes(cb) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
}
/** official `getDefaultCanTrack` side effect: the service follows the last `canTrack` seen. */
export function set_can_track(value) {
    can_track = value;
}
