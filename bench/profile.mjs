// CPU PROFILE of one SDK rendering one fixture fresh (new content object per render), many times.
//   node --cpu-prof --cpu-prof-dir=bench/prof bench/profile.mjs <sdk> <fixture.json> [renders]
// then: node bench/profile-summary.mjs bench/prof/<file>.cpuprofile
import fs from 'node:fs';
import { render_content, components_for } from './dist/entry.js';
const [, , sdk = 'ours', file, n = '3000'] = process.argv;
const raw = fs.readFileSync(file, 'utf8');
const spec = JSON.parse(raw);
const names = new Set();
const stack = [spec];
while (stack.length) {
	const v = stack.pop();
	if (!v || typeof v !== 'object') continue;
	if (v['@type'] === '@builder.io/sdk:Element' && v.component?.name) names.add(v.component.name);
	for (const k in v) stack.push(v[k]);
}
const comps = components_for([...names].sort())[sdk];
const render_props = spec.content ? { data: spec.data, locale: spec.locale } : {};
const BATCH = 100;
let done = 0;
const t0 = performance.now();
let render_ms = 0;
while (done < Number(n)) {
	const pool = Array.from({ length: BATCH }, () => { const s = JSON.parse(raw); return s.content ?? s; });
	const t = performance.now();
	for (const c of pool) render_content(sdk, { content: c, model: 'page', apiKey: 'k', customComponents: comps, canTrack: false, ...render_props });
	render_ms += performance.now() - t;
	done += BATCH;
}
console.log(sdk, (render_ms / done).toFixed(4), 'ms/render', 'total', (performance.now() - t0).toFixed(0), 'ms');
