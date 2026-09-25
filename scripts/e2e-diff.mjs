// Compare two Playwright `list` reporter outputs: which tests fail in B but pass (or are absent) in A.
import fs from 'node:fs';
const LINE_RE = /^\s+(✓|✘|-)\s+\d+\s+\[[^\]]+\]\s+›\s+(.*?)(?:\s+\(\d+(?:\.\d+)?m?s\))?$/;
const parse = (file) => {
	const out = new Map();
	for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
		const m = LINE_RE.exec(line);
		if (m) out.set(m[2].replace(/^src\/e2e-tests\//, ''), m[1]);
	}
	return out;
};
const [a, b] = [parse(process.argv[2]), parse(process.argv[3])];
const count = (m, s) => [...m.values()].filter((v) => v === s).length;
console.log(`A: ${count(a, '✓')} pass, ${count(a, '✘')} fail, ${count(a, '-')} skip`);
console.log(`B: ${count(b, '✓')} pass, ${count(b, '✘')} fail, ${count(b, '-')} skip`);
const regress = [...b].filter(([t, s]) => s === '✘' && a.get(t) === '✓').map(([t]) => t);
const fixed = [...b].filter(([t, s]) => s === '✓' && a.get(t) === '✘').map(([t]) => t);
console.log(`\nfail in B, pass in A (${regress.length}):`);
const by_file = new Map();
for (const t of regress) {
	const f = t.split(' › ')[0].replace(/:\d+:\d+$/, '');
	by_file.set(f, [...(by_file.get(f) ?? []), t.split(' › ').slice(1).join(' › ')]);
}
for (const [f, ts] of [...by_file].sort((x, y) => y[1].length - x[1].length)) {
	console.log(`  ${f} (${ts.length})`);
	for (const t of ts) console.log(`      ${t.slice(0, 110)}`);
}
console.log(`\npass in B, fail in A (${fixed.length}):`);
for (const t of fixed) console.log('  ' + t.slice(0, 130));
