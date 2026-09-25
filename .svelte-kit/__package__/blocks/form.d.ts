/** official `get(obj, path, defaultValue)`. */
export declare function get_at(obj: unknown, path: string, default_value?: unknown): unknown;
/** official lodash-style `set(obj, path, value)`: missing containers become arrays before an index. */
export declare function set_at(obj: Record<string, unknown>, path: string, value: unknown): void;
export type FormValue = File | boolean | number | string | FileList | undefined;
/** The named fields of a form and their typed values (official `formPairs`). */
export declare function form_pairs(form: HTMLElement): {
    key: string;
    value: FormValue;
}[];
/** The Builder form-submit endpoint for `sendSubmissionsTo: 'email'`. */
export declare function email_submit_url(api_key: unknown, email: string | undefined, name: string | undefined): string;
/** official `logFetch`. */
export declare function log_fetch(url: string): void;
