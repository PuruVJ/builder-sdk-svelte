import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// BUILDER_SDK=ours points the app's `@builder.io/sdk-svelte` imports at @puruvj/builder-sdk-svelte;
// the app's source is the official e2e app, unchanged.
const ours = process.env.BUILDER_SDK === 'ours';

export default defineConfig({
	resolve: {
		// Exact-name alias: only the APP's `@builder.io/sdk-svelte` import is redirected. The new SDK's own
		// editor hand-off imports the official SDK via `@builder.io/sdk-svelte/bundle/browser`, which must
		// still reach the real package (in a real app there is no alias at all).
		alias: ours ? [{ find: /^@builder\.io\/sdk-svelte$/, replacement: '@puruvj/builder-sdk-svelte' }] : []
	},
	server: { fs: { strict: false } },
	plugins: [sveltekit()]
});
