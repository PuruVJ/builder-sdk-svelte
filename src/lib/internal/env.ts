/** Environment checks — the official semantics (functions/is-*.ts). */

export type Search = URLSearchParams | string | Record<string, string | string[]>;

export const is_browser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

export const is_iframe = (): boolean => is_browser() && window.self !== window.top;

export function search_string(search: Search): string {
	if (typeof search === 'string') return search;
	if (search instanceof URLSearchParams) return search.toString();
	return new URLSearchParams(search as Record<string, string>).toString();
}

export function is_editing(search?: Search): boolean {
	return is_iframe() && search_string(search || window.location.search).indexOf('builder.frameEditing=') !== -1;
}

export function is_previewing(search?: Search): boolean {
	const s = search || (is_browser() ? window.location.search : undefined);
	if (!s) return false;
	return search_string(s).indexOf('builder.preview=') !== -1;
}
