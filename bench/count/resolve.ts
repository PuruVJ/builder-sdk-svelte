/**
 * Preload of the counted benches (`heisenbench run --import bench/count/resolve.ts`): resolve
 * packages the way Vite does for this repo's builds.
 *  - the `svelte` export condition (vite-plugin-svelte adds it): the official SDK's `exports` then
 *    give the build a SvelteKit app renders (`lib/browser`), as in bench/vite.ssr.config.ts;
 *  - with BENCH_BROWSER=1 (the client bench), the `browser` condition too: `svelte` is then Svelte's
 *    client runtime, as in a browser bundle;
 *  - relative imports with no extension inside a package (`svelte-package` output keeps them; a
 *    bundler resolves them, Node does not): `./x` → `./x.js` or `./x/index.js`.
 * Heisenbench's own imports are left alone (its parser has a `browser` build of its own).
 */
import { registerHooks } from 'node:module';

const CONDITIONS = process.env.BENCH_BROWSER === '1' ? ['svelte', 'browser'] : ['svelte'];
const OWN = /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:heisenbench|oxc-parser|@oxc-parser|magic-string|@jridgewell|tinybench|happy-dom)\//;
const KNOWN = /\.(?:[cm]?[jt]sx?|json|node|svelte|wasm)$/;

registerHooks({
	resolve(specifier, context, next) {
		const parent = context.parentURL ?? '';
		const ctx = OWN.test(parent) ? context : { ...context, conditions: [...(context.conditions ?? []), ...CONDITIONS] };
		try {
			return next(specifier, ctx);
		} catch (e) {
			if (!parent.includes('/node_modules/') || !specifier.startsWith('.') || KNOWN.test(specifier)) throw e;
			for (const candidate of [specifier + '.js', specifier + '/index.js']) {
				try {
					return next(candidate, ctx);
				} catch {
					// the next candidate
				}
			}
			throw e;
		}
	}
});
