/**
 * The `attributes` a noWrap block receives carry its wrapper attributes plus `on:<event>` handlers
 * (official `filterAttrs` + the `setAttrs` action). Svelte 5 attaches handlers from a spread, so they
 * are mapped to `on<event>` props instead of an action.
 */
export declare function plain_attrs(attrs: Record<string, unknown> | undefined): Record<string, unknown>;
export declare function event_attrs(attrs: Record<string, unknown> | undefined): Record<string, unknown>;
/** Both at once, for the common spread. */
export declare function all_attrs(attrs: Record<string, unknown> | undefined): Record<string, unknown>;
