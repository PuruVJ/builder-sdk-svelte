import { json } from '@sveltejs/kit';
import { put } from '../store';

/** POST /editor-fuzz/store?key=<key> with a content JSON body → /editor-fuzz?c=<key> renders it. */
export async function POST({ url, request }) {
	const key = url.searchParams.get('key');
	if (!key) return json({ error: 'key required' }, { status: 400 });
	put(key, await request.json());
	return json({ ok: true });
}
