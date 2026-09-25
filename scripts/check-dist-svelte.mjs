// Gate for the shipped `.svelte` files (they ship as SOURCE; the consumer's vite-plugin-svelte
// compiles them). Fails the build when:
//  1. a component does not compile as plain JS — the templates must be TS-free (no `lang="ts"`);
//  2. tag text `<style` / `<script` (or their closers) appears anywhere but a real top-level tag at
//     the start of a line — vite-plugin-svelte finds a component's style block with a regex over
//     the whole file, so such text in a string or comment is taken for the component's stylesheet
//     and breaks the consumer's build. Build those strings in a `.ts` module (internal/tags.ts);
//  3. an app's style preprocessor (run over every style block Svelte's preprocess() finds) would
//     touch anything but the component's one real style block — the 0.0.1 field break.
import { globSync, readFileSync } from 'node:fs';
import { compile, parse, preprocess } from 'svelte/compiler';

const TAG_TEXT_RE = /<\/?(style|script)\b/g;
// A style preprocessor that touches EVERY style block, as an app's PostCSS/Tailwind setup does.
// Svelte's preprocess() finds style blocks by regex, so it must see exactly the real ones.
const TOUCH_MARK = '/* consumer-preprocessed */';
const touch_all_styles = { name: 'touch-all-styles', style: ({ content }) => ({ code: content + TOUCH_MARK }) };

/** Where the component's REAL script/style tags open and close (Svelte's own parser). */
function real_tag_positions(source) {
	const ast = parse(source, { modern: true });
	const out = new Set();
	for (const node of [ast.module, ast.instance, ast.css]) {
		if (!node) continue;
		out.add(node.start);
		out.add(source.lastIndexOf('</', node.end - 1));
	}
	return out;
}

let bad = 0;
for (const file of globSync('dist/**/*.svelte')) {
	const source = readFileSync(file, 'utf8');
	for (const generate of ['server', 'client']) {
		try {
			compile(source, { filename: file, generate });
		} catch (e) {
			bad++;
			console.log(`${file} (${generate}): ${e.message.split('\n')[0]}`);
			break;
		}
	}
	// 3. the app's style preprocessor sees only the real style block
	const { code } = await preprocess(source, [touch_all_styles], { filename: file });
	const touched = code.split(TOUCH_MARK).length - 1;
	const real_styles = parse(source, { modern: true }).css ? 1 : 0;
	if (touched !== real_styles) {
		bad++;
		console.log(`${file}: an app style preprocessor would process ${touched} style block(s), the component has ${real_styles}`);
	}
	const real = real_tag_positions(source);
	for (const m of source.matchAll(TAG_TEXT_RE)) {
		if (real.has(m.index)) continue;
		bad++;
		const line_no = source.slice(0, m.index).split('\n').length;
		console.log(`${file}:${line_no}: tag text "${m[0]}" outside a real tag (build it in a .ts module)`);
	}
}
if (bad) process.exit(1);
console.log('all shipped .svelte files compile as plain JS and carry no stray style/script tag text');
