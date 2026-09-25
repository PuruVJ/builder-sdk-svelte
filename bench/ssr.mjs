// SSR BENCH MATRIX: every fixture × both SDKs × {fresh, same, cold}, one process per measurement.
//   node bench/ssr.mjs [budget_ms] [filter]
// Writes bench/results/ssr.json (one row per measurement).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const budget = process.argv[2] ?? '1500';
const filter = process.argv[3] ? new RegExp(process.argv[3]) : null;
const files = [];
for (const dir of ['fixtures/real', 'fixtures/pages', 'fixtures/gen']) {
	if (!fs.existsSync(path.join(ROOT, dir))) continue; // fixtures/real is local-only
	for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) {
		if (!f.endsWith('.json') || f.endsWith('.data.json')) continue;
		const rel = `${dir}/${f}`;
		if (filter && !filter.test(rel)) continue;
		files.push(rel);
	}
}
const out_file = path.join(ROOT, 'bench/results/ssr.json');
fs.mkdirSync(path.dirname(out_file), { recursive: true });
const rows = [];
let i = 0;
for (const file of files) {
	i++;
	for (const mode of ['fresh', 'same', 'cold']) {
		for (const sdk of ['official', 'ours']) {
			try {
				const line = execFileSync(
					process.execPath,
					['--expose-gc', '--max-old-space-size=8192', path.join(ROOT, 'bench/ssr-worker.mjs'), sdk, path.join(ROOT, file), mode, budget],
					{ cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], timeout: 600000 }
				)
					.toString()
					.trim()
					.split('\n')
					.pop();
				const row = { ...JSON.parse(line), file };
				rows.push(row);
			} catch (e) {
				rows.push({ sdk, file, mode, error: String(e.message).slice(0, 200) });
			}
		}
	}
	const pair = (m) => rows.filter((r) => r.file === file && r.mode === m);
	const [o, u] = ['official', 'ours'].map((s) => pair('fresh').find((r) => r.sdk === s));
	console.log(`[${i}/${files.length}] ${file}: fresh p50 ${o?.p50_ms?.toFixed(2)} → ${u?.p50_ms?.toFixed(3)} ms`);
	fs.writeFileSync(out_file, JSON.stringify(rows, null, 1));
}
