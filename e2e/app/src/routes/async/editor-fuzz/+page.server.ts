import { DEFAULT_CONTENT, get } from '../../editor-fuzz/store';

export function load({ url }) {
	return { content: get(url.searchParams.get('c')) ?? DEFAULT_CONTENT };
}
