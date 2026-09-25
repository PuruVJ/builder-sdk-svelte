// Who calls a function (self time of the callee, grouped by caller chain) in a .cpuprofile.
//   node bench/profile-callers.mjs <file.cpuprofile> <functionName> [depth]
import fs from 'node:fs';
const [, , file, fn, depth = '4'] = process.argv;
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const by_id = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const dt = new Map();
for (let i = 0; i < p.samples.length; i++) dt.set(p.samples[i], (dt.get(p.samples[i]) ?? 0) + (p.timeDeltas[i] ?? 0));
const chains = new Map();
for (const n of p.nodes) {
	if (n.callFrame.functionName !== fn) continue;
	let chain = [];
	let id = parent.get(n.id);
	for (let d = 0; d < Number(depth) && id; d++, id = parent.get(id)) chain.push(by_id.get(id).callFrame.functionName || '(anon)');
	const key = chain.join(' ← ');
	chains.set(key, (chains.get(key) ?? 0) + (dt.get(n.id) ?? 0));
}
for (const [k, t] of [...chains].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log((t / 1000).toFixed(1).padStart(8) + 'ms', k);
