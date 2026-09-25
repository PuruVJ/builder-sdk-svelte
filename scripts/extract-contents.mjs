// Every Builder content object (`{ id, data: { blocks } }`) in an extracted page-data file → one
// fixture file per content, named <page>.<key>.json.
import fs from 'node:fs';
import path from 'node:path';
const [, , input, prefix] = process.argv;
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const seen = new Set();
const found = [];
(function walk(v, key) {
	if (!v || typeof v !== 'object' || seen.has(v)) return;
	seen.add(v);
	if (!Array.isArray(v) && v.data && Array.isArray(v.data.blocks) && v.id) found.push([key, v]);
	for (const k in v) walk(v[k], k);
})(data, 'root');
for (const [key, v] of found) {
	const file = `${prefix}.${key}.json`;
	fs.writeFileSync(file, JSON.stringify(v));
	console.log(path.basename(file), fs.statSync(file).size);
}
