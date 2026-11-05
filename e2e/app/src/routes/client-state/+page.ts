// test-only: tests/client-state.test.ts
import { CONTENTS } from './contents';

export function load({ url }) {
	return { content: CONTENTS[url.searchParams.get('c') ?? ''] ?? null };
}
