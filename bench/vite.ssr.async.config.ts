import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// bench/vite.ssr.config.ts, compiled in Svelte's async mode (`experimental.async`, as an app that
// turns it on compiles every component — the SDKs' included) → bench/dist-async (tests/async-ssr.test.ts).
export default defineConfig({
	plugins: [svelte({ compilerOptions: { dev: false, experimental: { async: true } } })],
	build: {
		ssr: 'bench/entry-async.ts',
		outDir: 'bench/dist-async',
		emptyOutDir: true,
		minify: false,
		target: 'node22',
		rollupOptions: { output: { format: 'es', entryFileNames: 'entry.js' } }
	},
	ssr: { noExternal: ['@builder.io/sdk-svelte', '@builder.io/sdk-svelte-latest'] },
	logLevel: 'warn'
});
