/** Environment checks — the official semantics (functions/is-*.ts). */
export type Search = URLSearchParams | string | Record<string, string | string[]>;
export declare const is_browser: () => boolean;
export declare const is_iframe: () => boolean;
export declare function search_string(search: Search): string;
export declare function is_editing(search?: Search): boolean;
export declare function is_previewing(search?: Search): boolean;
