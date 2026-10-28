import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// BUILDER_SDK=ours points the app's `@builder.io/sdk-svelte` imports at @puruvj/builder-sdk-svelte;
// BUILDER_SDK=latest points them at the newest official release (installed as @builder.io/sdk-svelte-latest);
// the app's source is the official e2e app, unchanged.
const sdk = process.env.BUILDER_SDK;
const target = sdk === 'ours' ? '@puruvj/builder-sdk-svelte' : sdk === 'latest' ? '@builder.io/sdk-svelte-latest' : null;

export default defineConfig({
	resolve: {
		// Exact-name alias: only the APP's `@builder.io/sdk-svelte` import is redirected. The new SDK's own
		// editor hand-off imports the official SDK via `@builder.io/sdk-svelte/bundle/browser`, which must
		// still reach the real package (in a real app there is no alias at all).
		alias: target ? [{ find: /^@builder\.io\/sdk-svelte$/, replacement: target }] : []
	},
	server: { fs: { strict: false } },
	plugins: [sveltekit()]
});
