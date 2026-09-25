// ONE measurement: one SDK × one fixture × one mode, in its own process (no JIT / GC cross-talk).
//   node --expose-gc bench/ssr-worker.mjs <sdk> <fixture.json> <mode: fresh|same|cold> [budget_ms]
// Prints one JSON line.
import fs from 'node:fs';
import zlib from 'node:zlib';
import v8 from 'node:v8';

const t_boot = performance.now();
const [, , sdk, file, mode, budget_arg] = process.argv;
const budget = Number(budget_arg ?? 3000);
const ELEMENT = '@builder.io/sdk:Element';

const raw = fs.readFileSync(file, 'utf8');
const spec = JSON.parse(raw);
const content = spec.content ?? spec;
const names = new Set();
(function walk(v) {
	if (!v || typeof v !== 'object') return;
	if (v['@type'] === ELEMENT && v.component?.name) names.add(v.component.name);
	for (const k in v) walk(v[k]);
})(content);

const t_import = performance.now();
const { render_content, components_for } = await import('./dist/entry.js');
const import_ms = performance.now() - t_import;
const comps = components_for([...names].sort())[sdk];
// Render props (`data`, `locale`) only from a generated spec `{ content, data, locale }`. A captured
// content IS the spec: its `.data` is the content's own data (blocks included), and passing that as
// the `data` prop would hand every "fresh" render the same blocks array — a cached plan, not fresh.
const render_props = spec.content ? { data: spec.data, locale: spec.locale } : {};
const props = (c) => ({ content: c, model: 'page', apiKey: 'bench', customComponents: comps, canTrack: false, ...render_props });

const out = { sdk, fixture: file.split('/').pop(), mode, bytes_in: raw.length };

if (mode === 'cold') {
	// The first render in a fresh process: module load + first compile of every block + the render.
	const c = JSON.parse(raw);
	const t = performance.now();
	const html = render_content(sdk, props(c.content ?? c)).body;
	out.first_render_ms = performance.now() - t;
	out.import_ms = import_ms;
	out.boot_to_first_ms = performance.now() - t_boot;
	out.html_bytes = html.length;
	out.html_gzip = zlib.gzipSync(html).length;
	out.html_brotli = zlib.brotliCompressSync(html).length;
	console.log(JSON.stringify(out));
	process.exit(0);
}

// FRESH: a new content object per render — the per-request case (the app fetched JSON and parsed it).
// Clones are made up front (not timed), in batches, so parsing never counts against the SDK.
const BATCH = 50;
const make_batch = () => Array.from({ length: BATCH }, () => JSON.parse(raw)).map((c) => c.content ?? c);
let batch = mode === 'fresh' ? make_batch() : null;
let bi = 0;
const same = mode === 'same' ? content : null;
const next = () => {
	if (same) return same;
	if (bi === BATCH) {
		batch = make_batch();
		bi = 0;
	}
	return batch[bi++];
};

// warm-up (JIT)
for (let i = 0; i < 15; i++) render_content(sdk, props(next()));

// timed runs
global.gc();
const heap_before = process.memoryUsage().heapUsed;
const gc_profiler = new v8.GCProfiler();
gc_profiler.start();
const cpu0 = process.cpuUsage();
const times = [];
let cpu_us = 0;
let html = '';
const t_start = performance.now();
let clone_ms = 0;
while ((performance.now() - t_start - clone_ms < budget || times.length < 30) && times.length < 20000) {
	// time spent making the next clone batch is not the SDK's — exclude it from the budget
	let c;
	if (mode === 'fresh' && bi === BATCH) {
		const tc = performance.now();
		c = next();
		clone_ms += performance.now() - tc;
	} else c = next();
	const p = props(c);
	const u0 = process.cpuUsage();
	const t = performance.now();
	html = render_content(sdk, p).body;
	times.push(performance.now() - t);
	const u = process.cpuUsage(u0);
	cpu_us += u.user + u.system;
}
const cpu = { user: cpu_us, system: 0 };
void cpu0;
const gc = gc_profiler.stop();
let gc_ms = 0;
for (const s of gc.statistics) gc_ms += s.cost / 1000;

// RETAINED: after all those renders and a full GC, how much more heap is held than before? (the
// bench's own pre-made clones dropped first) — a leak shows up here.
batch = null;
global.gc();
const retained = process.memoryUsage().heapUsed - heap_before;

/** Bytes the heap took in over a stretch: what each GC reclaimed + what is still held at the end. */
function allocated_over(stats, start, end) {
	let total = 0;
	let last = start;
	for (const s of stats) {
		total += Math.max(0, s.beforeGC.heapStatistics.usedHeapSize - last);
		last = s.afterGC.heapStatistics.usedHeapSize;
	}
	return total + Math.max(0, end - last);
}

// ALLOCATION PASS (separate from timing): inputs made first, outside the profiled stretch, so only
// the SDK's own allocations are counted.
const K = 40;
const pool = mode === 'fresh' ? Array.from({ length: K }, () => JSON.parse(raw)).map((c) => c.content ?? c) : null;
const pool_props = Array.from({ length: K }, (_, i) => props(pool ? pool[i] : content));
global.gc();
const a0 = process.memoryUsage().heapUsed;
const alloc_profiler = new v8.GCProfiler();
alloc_profiler.start();
for (let i = 0; i < K; i++) render_content(sdk, pool_props[i]);
const alloc_stats = alloc_profiler.stop();
const allocated = (allocated_over(alloc_stats.statistics, a0, process.memoryUsage().heapUsed) / K) * times.length;

times.sort((a, b) => a - b);
const q = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))];
Object.assign(out, {
	runs: times.length,
	mean_ms: times.reduce((a, b) => a + b, 0) / times.length,
	p50_ms: q(0.5),
	p95_ms: q(0.95),
	p99_ms: q(0.99),
	min_ms: times[0],
	max_ms: times[times.length - 1],
	cpu_ms_per_render: (cpu.user + cpu.system) / 1000 / times.length,
	alloc_bytes_per_render: allocated / times.length,
	gc_count: gc.statistics.length,
	gc_ms_per_render: gc_ms / times.length,
	retained_bytes: retained,
	html_bytes: html.length,
	html_gzip: zlib.gzipSync(html).length,
	html_brotli: zlib.brotliCompressSync(html).length
});
console.log(JSON.stringify(out));
