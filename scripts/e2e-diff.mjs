// Compare two Playwright `list` reporter outputs (`pnpm e2e:official --reporter=list > a.txt`):
//   node scripts/e2e-diff.mjs a.txt b.txt            which tests fail in B but pass in A, and the reverse
//   node scripts/e2e-diff.mjs --list a.txt [regex]   every test's status in one run (optionally filtered)
//
// Status per test: pass | fail | skip | xfail. A `✘` line whose test is NOT in the run's final
// "N failed" summary is an expected failure (`test.fail()` that did fail) — Playwright counts it as
// passed, and so does this script ('xfail'). Labels drop the `src/e2e-tests/` prefix.
import fs from 'node:fs';

const LINE_RE = /^\s+(✓|✘|-)\s+\d+\s+\[[^\]]+\]\s+›\s+(.*?)(?:\s+\(\d+(?:\.\d+)?m?s\))?\s*$/;
const SUMMARY_RE = /^\s+\d+ (failed|flaky|passed|skipped|did not run|interrupted)/;
const SUMMARY_ITEM_RE = /^\s+\[[^\]]+\]\s+›\s+(.*?)[\s─]*$/;
const label = (s) => s.replace(/^src\/e2e-tests\//, '').trim();

/** @returns {Map<string, 'pass' | 'fail' | 'skip' | 'xfail' | 'flaky'>} */
export function parse(file) {
	const lines = fs.readFileSync(file, 'utf8').split('\n');
	const out = new Map();
	const failed = new Set();
	const flaky = new Set();
	let section = null;
	for (const line of lines) {
		const s = SUMMARY_RE.exec(line);
		if (s) {
			section = s[1];
			continue;
		}
		if (section === 'failed' || section === 'flaky') {
			const m = SUMMARY_ITEM_RE.exec(line);
			if (m) (section === 'failed' ? failed : flaky).add(label(m[1]));
			continue;
		}
		const m = LINE_RE.exec(line);
		if (m) out.set(label(m[2]), m[1] === '✓' ? 'pass' : m[1] === '-' ? 'skip' : 'fail');
	}
	// Without a summary (a run cut short) every ✘ stays a fail.
	if (failed.size || flaky.size)
		for (const [t, s] of out) {
			if (flaky.has(t)) out.set(t, 'flaky');
			else if (s === 'fail' && !failed.has(t)) out.set(t, 'xfail');
		}
	return out;
}

const ok = (s) => s === 'pass' || s === 'xfail' || s === 'flaky';
const counts = (m) => {
	const c = { pass: 0, fail: 0, skip: 0, xfail: 0, flaky: 0 };
	for (const s of m.values()) c[s]++;
	return `${c.pass + c.xfail + c.flaky} pass (${c.xfail} expected-fail, ${c.flaky} flaky), ${c.fail} fail, ${c.skip} skip`;
};

if (import.meta.url === `file://${process.argv[1]}`) {
	const args = process.argv.slice(2);
	if (args[0] === '--list') {
		const m = parse(args[1]);
		const re = args[2] ? new RegExp(args[2]) : null;
		console.log(counts(m));
		for (const [t, s] of [...m].sort((x, y) => x[0].localeCompare(y[0]))) if (!re || re.test(t)) console.log(`${s.padEnd(5)} ${t}`);
	} else {
		const [a, b] = [parse(args[0]), parse(args[1])];
		console.log(`A: ${counts(a)}`);
		console.log(`B: ${counts(b)}`);
		const regress = [...b].filter(([t, s]) => s === 'fail' && ok(a.get(t))).map(([t]) => t);
		const fixed = [...b].filter(([t, s]) => ok(s) && a.get(t) === 'fail').map(([t]) => t);
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
	}
}
