// test-only: tests/client-ab-tests.test.ts — an official spec's content (`?p=/ab-test`) with
// `canTrack` from `?canTrack=0|1`
import { PAGES } from '@sdk/tests';

export function load({ url }) {
	const content = PAGES[url.searchParams.get('p') ?? '']?.content ?? null;
	return { content: content && JSON.parse(JSON.stringify(content)), canTrack: url.searchParams.get('canTrack') !== '0' };
}
