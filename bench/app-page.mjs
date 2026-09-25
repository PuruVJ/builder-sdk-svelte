// APP-SHAPED SSR BENCH: one field REQUEST = the whole page's <Content> roots (accessibility, body,
// support, footer) through one SDK, with the field's component shapes (bench/app/*): Svelte 4
// components, builderBlock-only props, a 230-entry body list kept by the app (same array each
// request) and small inline lists made fresh per request. Content is fresh per request (fetched).
//   node --expose-gc bench/app-page.mjs            → runs every page × SDK in its own process
//   node --expose-gc bench/app-page.mjs <sdk> <page> [budget_ms]   → one measurement (JSON line)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';

const ROOT = path.resolve(import.meta.dirname, '..');
// captured pages when present locally (gitignored), else the synthetic production-shaped ones;
// FIXTURES=pages forces the synthetic set
const REAL = path.join(ROOT, 'fixtures/real');
const DIR = process.env.FIXTURES !== 'pages' && fs.existsSync(REAL) ? REAL : path.join(ROOT, 'fixtures/pages');
const ELEMENT = '@builder.io/sdk:Element';
const KINDS = [
	['accessibilityContent', 'inline'],
	['pageContent', 'body'],
	['content', 'inline'],
	['getFooterContent', 'inline']
];

function names_in(v, out = new Set()) {
	if (!v || typeof v !== 'object') return out;
	if (v['@type'] === ELEMENT && v.component?.name) out.add(v.component.name);
	for (const k in v) names_in(v[k], out);
	return out;
}

const [, , sdk, page, budget_arg] = process.argv;

if (!sdk) {
	const pages = [...new Set(fs.readdirSync(DIR).filter((f) => f.endsWith('.pageContent.json')).map((f) => f.split('.')[0]))].sort();
	const rows = [];
	for (const p of pages) {
		const pair = {};
		for (const s of ['official', 'ours']) {
			const line = execFileSync(process.execPath, ['--expose-gc', import.meta.filename, s, p, '1500'], { stdio: ['ignore', 'pipe', 'ignore'] })
				.toString()
				.trim()
				.split('\n')
				.pop();
			pair[s] = JSON.parse(line);
			rows.push(pair[s]);
		}
		const o = pair.official, u = pair.ours;
		console.log(
			`${p.padEnd(52)} ${(o.bytes_in / 1024) | 0}K  p50 ${o.p50_ms.toFixed(2)} → ${u.p50_ms.toFixed(3)} ms (${(o.p50_ms / u.p50_ms).toFixed(0)}x)  ` +
				`cpu ${o.cpu_ms.toFixed(2)} → ${u.cpu_ms.toFixed(3)}  alloc ${(o.alloc_bytes / 1e6).toFixed(1)} → ${(u.alloc_bytes / 1e6).toFixed(2)} MB  ` +
				`gc ${o.gc_ms.toFixed(2)} → ${u.gc_ms.toFixed(3)}  html ${o.html_bytes} → ${u.html_bytes}`
		);
	}
	fs.mkdirSync(path.join(ROOT, 'bench/results'), { recursive: true });
	fs.writeFileSync(path.join(ROOT, 'bench/results/app-page.json'), JSON.stringify(rows, null, 1));
	process.exit(0);
}

const { render_app_page, app_components } = await import('./dist/entry.js');
const raws = KINDS.map(([kind, list]) => {
	const file = path.join(DIR, `${page}.${kind}.json`);
	return fs.existsSync(file) ? { raw: fs.readFileSync(file, 'utf8'), list } : null;
}).filter(Boolean);
const all_names = [...names_in(raws.map((r) => JSON.parse(r.raw)))].sort();
// The app's body list: built once, same array every request (the field LRU hands back the same one).
const body_list = app_components(sdk, { names: all_names, size: 230 });

/** One request's inputs, made OUTSIDE the timed stretch: fresh content, fresh inline lists. */
function request() {
	return raws.map(({ raw, list }) => {
		const spec = JSON.parse(raw);
		const content = spec.content ?? spec;
		const components = list === 'body' ? body_list : app_components(sdk, { names: [...names_in(content)], size: 1 });
		return { model: 'page', content, components };
	});
}
const go = (roots) => render_app_page(sdk, roots).body;

for (let i = 0; i < 15; i++) go(request());

const budget = Number(budget_arg ?? 1500);
const times = [];
let cpu_us = 0;
let html = '';
let spent = 0;
while ((spent < budget || times.length < 30) && times.length < 20000) {
	const roots = request();
	const u0 = process.cpuUsage();
	const t = performance.now();
	html = go(roots);
	const dt = performance.now() - t;
	const u = process.cpuUsage(u0);
	times.push(dt);
	spent += dt;
	cpu_us += u.user + u.system;
}
times.sort((a, b) => a - b);
const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];

// Allocation + GC: inputs made first, then only the renders are profiled.
const K = 30;
const pool = Array.from({ length: K }, request);
global.gc();
const gcp = new v8.GCProfiler();
const h0 = process.memoryUsage().heapUsed;
gcp.start();
for (const roots of pool) go(roots);
const h1 = process.memoryUsage().heapUsed;
const stats = gcp.stop().statistics;
let alloc = 0;
let last = h0;
let gc_ms = 0;
for (const s of stats) {
	alloc += Math.max(0, s.beforeGC.heapStatistics.usedHeapSize - last);
	last = s.afterGC.heapStatistics.usedHeapSize;
	gc_ms += s.cost / 1000;
}
alloc += Math.max(0, h1 - last);

console.log(
	JSON.stringify({
		sdk,
		page,
		roots: raws.length,
		bytes_in: raws.reduce((a, r) => a + r.raw.length, 0),
		runs: times.length,
		p50_ms: q(0.5),
		p95_ms: q(0.95),
		p99_ms: q(0.99),
		cpu_ms: cpu_us / 1000 / times.length,
		alloc_bytes: alloc / K,
		gc_ms: gc_ms / K,
		html_bytes: html.length
	})
);
