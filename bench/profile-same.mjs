// CPU PROFILE of the FIXED per-render cost: the same content object rendered again and again (no
// parse, compiled plan reused) — everything left is per-render work.
//   node --cpu-prof --cpu-prof-dir=bench/prof bench/profile-same.mjs <sdk> <fixture.json> [renders]
import fs from 'node:fs';
import { render_content, components_for } from './dist/entry.js';
const [, , sdk = 'ours', file, n = '20000'] = process.argv;
const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
const content = spec.content ?? spec;
const names = new Set();
const stack = [content];
while (stack.length) {
	const v = stack.pop();
	if (!v || typeof v !== 'object') continue;
	if (v['@type'] === '@builder.io/sdk:Element' && v.component?.name) names.add(v.component.name);
	for (const k in v) stack.push(v[k]);
}
const props = { content, model: 'page', apiKey: 'k', customComponents: components_for([...names].sort())[sdk], canTrack: false };
const t = performance.now();
for (let i = 0; i < Number(n); i++) render_content(sdk, props);
console.log(sdk, ((performance.now() - t) / Number(n)).toFixed(4), 'ms/render');
