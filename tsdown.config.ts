import { cpSync, existsSync, globSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preprocess, type PreprocessorGroup } from 'svelte/compiler';
import { emitDts } from 'svelte2tsx';
import { defineConfig } from 'tsdown';
import ts from 'typescript';

const root = fileURLToPath(new URL('.', import.meta.url));
const LANG_TS_RE = /(<script\b[^>]*?)\s+lang=(["'])ts\2/g;

/**
 * Strip TypeScript from a component's `<script>`s with TypeScript itself, VERBATIM: every import and
 * export not marked `type` is kept as written. A component script is only half the module — the
 * template uses imports the script never mentions, and `export { view }` in a module script names a
 * template SNIPPET the script cannot see. esbuild (vitePreprocess) elides that export as "probably a
 * type": 0.0.3 shipped `export {}` and every consumer's `import { view }` broke.
 * (scripts/check-dist-svelte.mjs now checks every import between shipped files resolves.)
 */
const strip_types: PreprocessorGroup = {
	name: 'builder-sdk-svelte:strip-types',
	script({ content, attributes, filename }) {
		if (attributes.lang !== 'ts') return;
		const { outputText } = ts.transpileModule(content, {
			fileName: filename,
			compilerOptions: {
				target: ts.ScriptTarget.ESNext,
				module: ts.ModuleKind.ESNext,
				verbatimModuleSyntax: true,
				useDefineForClassFields: true
			}
		});
		return { code: outputText };
	}
};

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
	plugins: [svelte_source(strip_types)],
	deps: {
		neverBundle: ['svelte', /^svelte\//, /^@builder\.io\/sdk-svelte(\/|$)/, /\.svelte$/]
	}
});
