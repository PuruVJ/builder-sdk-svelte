import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Both SDKs' SERVER code, bundled for Node exactly as a SvelteKit server build would compile them.
export default defineConfig({
	plugins: [svelte({ compilerOptions: { dev: false } })],
	build: {
		ssr: 'bench/entry.ts',
		outDir: 'bench/dist',
		emptyOutDir: true,
		minify: false,
		target: 'node22',
		rollupOptions: { output: { format: 'es', entryFileNames: 'entry.js' } }
	},
	ssr: { noExternal: ['@builder.io/sdk-svelte'] },
	logLevel: 'warn'
});
