import { cpSync, existsSync, globSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { preprocess, type PreprocessorGroup } from 'svelte/compiler';
import { emitDts } from 'svelte2tsx';
import { defineConfig } from 'tsdown';

const root = fileURLToPath(new URL('.', import.meta.url));
const LANG_TS_RE = /(<script\b[^>]*?)\s+lang=(["'])ts\2/g;

/**
 * `.svelte` components ship as SOURCE at their parallel paths (the consumer's vite-plugin-svelte
 * compiles them), with TypeScript stripped from their scripts, plus a `.svelte.d.ts` beside each
 * (svelte2tsx's `emitDts`, the engine svelte-package uses). Assets are emitted in `buildStart` /
 * copied in `writeBundle` so `clean: true` does not wipe them.
 */
const svelte_source = (preprocessor: PreprocessorGroup) => ({
	name: 'builder-sdk-svelte:svelte-source',
	async buildStart() {
		for (const abs of globSync('src/lib/**/*.svelte')) {
			const fileName = abs.replace(/^src[\\/]lib[\\/]/, '');
			const { code } = await preprocess(readFileSync(abs, 'utf8'), preprocessor, { filename: abs });
			// @ts-expect-error rolldown plugin context
			this.emitFile({ type: 'asset', fileName, source: code.replace(LANG_TS_RE, '$1') });
		}
	},
	async writeBundle() {
		const tmp = join(root, '.svelte-dts');
		rmSync(tmp, { recursive: true, force: true });
		await emitDts({
			libRoot: join(root, 'src/lib'),
			declarationDir: tmp,
			svelteShimsPath: fileURLToPath(import.meta.resolve('svelte2tsx/svelte-shims-v4.d.ts'))
		});
		for (const abs of globSync('src/lib/**/*.svelte')) {
			const rel = `${abs.replace(/^src[\\/]lib[\\/]/, '')}.d.ts`;
			const from = join(tmp, rel);
			if (existsSync(from)) cpSync(from, join(root, 'dist', rel));
		}
		rmSync(tmp, { recursive: true, force: true });
	}
});

// The library's modules, one output file per source file (`unbundle`): the shipped `.svelte`
// components import `../internal/*.js` relatively, so the structure must stay parallel.
export default defineConfig({
	entry: ['src/lib/**/*.ts', 'src/lib/**/*.js', '!src/lib/**/*.d.ts'],
	outDir: 'dist',
	format: 'esm',
	platform: 'neutral', // runs on the server (SSR) and in the browser
	unbundle: true,
	dts: true,
	clean: true,
	treeshake: false, // every module is kept intact; the consumer's bundler tree-shakes
	plugins: [svelte_source(vitePreprocess({ script: true }))],
	deps: {
		neverBundle: ['svelte', /^svelte\//, /^@builder\.io\/sdk-svelte(\/|$)/, /\.svelte$/]
	}
});
