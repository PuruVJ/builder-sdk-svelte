/**
 * bench/entry.ts, for a build compiled in Svelte's async mode (bench/vite.ssr.async.config.ts →
 * bench/dist-async): the same exports, plus `render_content_async`, which awaits the render — in async
 * mode, a render with pending async work only completes when awaited.
 */
import { render } from 'svelte/server';
import { Content as OfficialContent } from '@builder.io/sdk-svelte';
import { Content as LatestContent } from '@builder.io/sdk-svelte-latest';
import { Content as OursContent } from '../src/lib/index.js';
import type { Sdk } from './entry.js';

export * from './entry.js';

const CONTENT = { official: OfficialContent, latest: LatestContent, ours: OursContent };

export async function render_content_async(sdk: Sdk, props: Record<string, unknown>): Promise<{ head: string; body: string }> {
	const out = await render(CONTENT[sdk] as never, { props: props as never });
	return { head: out.head, body: out.body };
}
