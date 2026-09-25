import fs from 'node:fs';
import { render_content, components_for } from '../bench/dist/entry.js';
const file = process.argv[2];
const content = JSON.parse(fs.readFileSync(file, 'utf8'));
const names = new Set();
(function w(v) { if (!v || typeof v !== 'object') return; if (v['@type'] === '@builder.io/sdk:Element' && v.component?.name) names.add(v.component.name); for (const k in v) w(v[k]); })(content);
const comps = components_for([...names].sort());
for (const sdk of ['official', 'ours']) {
	const props = { content, model: 'page', apiKey: 'x', customComponents: comps[sdk], canTrack: false };
	let t = performance.now();
	const out = render_content(sdk, props);
	const first = performance.now() - t;
	t = performance.now();
	for (let i = 0; i < 20; i++) render_content(sdk, props);
	console.log(sdk, 'first', first.toFixed(1), 'ms | warm', ((performance.now() - t) / 20).toFixed(2), 'ms | html', out.body.length, '| head', out.head.length);
	fs.writeFileSync(`/tmp/smoke-${sdk}.html`, out.body);
}
