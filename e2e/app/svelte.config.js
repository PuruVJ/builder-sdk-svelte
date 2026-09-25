import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// BUILDER_SDK=official | ours — the SAME app source, built against either SDK, each into its own
// output dir so both can be served side by side (e2e/suite/playwright.config.ts).
const which = process.env.BUILDER_SDK === 'ours' ? 'ours' : 'official';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ out: `build-${which}` }),
		outDir: `.svelte-kit-${which}`
	}
};
