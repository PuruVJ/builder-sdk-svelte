export declare const USER_ATTRIBUTES_COOKIE_NAME = "builder.userAttributes";
type Attrs = Record<string, unknown>;
export declare function get_user_attributes_cookie(): Attrs;
export declare function set_user_attributes(next: Attrs): void;
export declare function on_user_attributes(cb: (attrs: Attrs) => void): () => void;
/** official `getDefaultCanTrack` side effect: the service follows the last `canTrack` seen. */
export declare function set_can_track(value: boolean): void;
export {};
