// Gate: bundle the BUILT package the way an app does — Vite + vite-plugin-svelte, server and
// client — so a broken import between shipped files (0.0.3: `import { view }` from a Block.svelte
// whose export the TS strip had deleted) fails the build here, not in someone's app.
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = path.join(ROOT, '.check-bundle');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
// every public export is referenced, so nothing is shaken away before it is resolved
const entry = path.join(tmp, 'entry.js');
fs.writeFileSync(entry, `import * as sdk from '${path.join(ROOT, 'dist/index.js')}';\nexport default sdk;\n`);

let failed = false;
for (const ssr of [true, false]) {
	try {
		await build({
			configFile: false,
			logLevel: 'error',
			root: tmp,
			plugins: [svelte({ compilerOptions: { dev: false } })],
			build: {
				ssr: ssr ? entry : undefined,
				lib: ssr ? undefined : { entry, formats: ['es'], fileName: 'client' },
				outDir: path.join(tmp, ssr ? 'server' : 'client'),
				write: false,
				minify: false,
				rollupOptions: { external: [/^svelte($|\/)/, /^@builder\.io\/sdk-svelte/] }
			},
			ssr: { noExternal: true }
		});
		console.log(`bundles as an app would (${ssr ? 'server' : 'client'})`);
	} catch (e) {
		failed = true;
		console.log(`BUNDLE FAILED (${ssr ? 'server' : 'client'}): ${String(e.message).split('\n')[0]}`);
	}
}
fs.rmSync(tmp, { recursive: true, force: true });
if (failed) process.exit(1);
