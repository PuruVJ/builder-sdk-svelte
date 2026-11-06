import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// BUILDER_SDK=official | latest | ours — the SAME app source, built against either SDK, each into its own
// output dir so both can be served side by side (e2e/suite/playwright.config.ts).
const which = ['ours', 'latest'].includes(process.env.BUILDER_SDK) ? process.env.BUILDER_SDK : 'official';
// SVELTE_ASYNC=1 — the same again, compiled in Svelte's async mode (`experimental.async`, as apps that
// use `await` in components turn on), into `build-<sdk>-async`. It applies to every .svelte file in the
// build, the SDK's own components included — which is what breaks Svelte-4-era SDK code.
const async_mode = process.env.SVELTE_ASYNC === '1';
const out = which + (async_mode ? '-async' : '');

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	compilerOptions: async_mode ? { experimental: { async: true } } : {},
	kit: {
		adapter: adapter({ out: `build-${out}` }),
		outDir: `.svelte-kit-${out}`
	}
};
