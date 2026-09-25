// Pull SvelteKit's serialized page data out of a captured page: run the inline boot script with its
// `import()`s and DOM reads stubbed, and capture what it hands `kit.start`.
import fs from 'node:fs';
//   node scripts/extract-kit-data.mjs page.html page.data.json [page-url]
const [, , input, output, page_url = 'https://example.com/'] = process.argv;
const html = fs.readFileSync(input, 'utf8');
const SCRIPT_RE = /<script[^>]*>([\s\S]*?)<\/script>/g;
let boot = null;
for (const m of html.matchAll(SCRIPT_RE)) if (m[1].includes('kit.start') || m[1].includes('.start(app')) boot = m[1];
if (!boot) throw new Error('no kit boot script');
const IMPORT_RE = /\bimport\(/g;
let captured = null;
const kit = { start: (_app, _el, opts) => (captured = opts) };
const g = {
	location: new URL(page_url),
	document: { currentScript: { parentElement: {} }, querySelector: () => null },
	window: {}
};
const fn = new Function('location', 'document', 'window', '__imp', boot.replace(IMPORT_RE, '__imp('));
fn(g.location, g.document, g.window, () => Promise.resolve(kit));
await new Promise((r) => setTimeout(r, 50));
if (!captured) throw new Error('kit.start not reached');
fs.writeFileSync(output, JSON.stringify(captured.data));
console.log('nodes', captured.data.length, 'bytes', fs.statSync(output).size);
