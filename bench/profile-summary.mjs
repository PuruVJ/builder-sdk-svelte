// Self time per function (and per file) from a .cpuprofile — the top N.
import fs from 'node:fs';
const [, , file, top = '40'] = process.argv;
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const dt = new Map();
for (let i = 0; i < p.samples.length; i++) dt.set(p.samples[i], (dt.get(p.samples[i]) ?? 0) + (p.timeDeltas[i] ?? 0));
const self = new Map();
let total = 0;
for (const node of p.nodes) {
	const t = dt.get(node.id) ?? 0;
	total += t;
	const cf = node.callFrame;
	const key = `${cf.functionName || '(anon)'}  ${cf.url.split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`;
	self.set(key, (self.get(key) ?? 0) + t);
}
const rows = [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(top));
for (const [k, t] of rows) console.log(((t / total) * 100).toFixed(1).padStart(5) + '%', k);
