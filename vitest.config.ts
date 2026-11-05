import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// Tests import the SDK from source: `.svelte` compiles here (server output under Node), so a test can
// render a component directly and coverage is measured on src/lib, not on a bundle.
export default defineConfig({
	plugins: [svelte({ configFile: false, compilerOptions: { dev: false } })],
	resolve: { conditions: ['svelte'] },
	test: {
		include: ['tests/**/*.test.ts'],
		testTimeout: 60000,
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.{ts,svelte}'],
			exclude: ['src/lib/official/**', 'src/lib/**/*.d.ts'],
			reporter: ['text-summary', 'json-summary', 'html']
		}
	}
});
