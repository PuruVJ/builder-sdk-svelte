/**
 * FUZZ: render parity on random content (tests/fuzz/gen.ts). For every seed, the same content goes
 * through both SDKs' server render and must give the same normalised DOM tree, the same CSS rules
 * and the same props at every custom component (exactly what tests/equivalence.test.ts checks on the
 * fixtures), our render must not throw where the official one does not, and ours with PLAIN on must
 * be byte-identical to ours with PLAIN off (tests/plain.test.ts).
 *
 *   FUZZ_SEEDS=2000 npx vitest run tests/fuzz.test.ts   # more seeds (default 300)
 *   FUZZ_SEED=1234  npx vitest run tests/fuzz.test.ts   # reproduce one seed
 *
 * A failing seed is shrunk (tests/fuzz/check.ts) and its minimal content printed as JSON.
 * Seeds where the official render itself throws are recorded and listed at the end, not failed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { generate, type Spec } from './fuzz/gen.js';
import { check, shrink, size_of, type Failure } from './fuzz/check.js';
import { known_official, neutralize } from './fuzz/known.js';
// @ts-ignore built by `pnpm bench:build`
import { set_echo, set_plain } from '../bench/dist/entry.js';

const ONE = process.env.FUZZ_SEED;
const N = Number(process.env.FUZZ_SEEDS ?? 300);
const seeds = ONE !== undefined ? [Number(ONE)] : Array.from({ length: N }, (_, i) => i + 1);

const official_crashes: Array<[number, string]> = [];
const crash_repro = new Map<string, { spec: Spec; ours: string }>();
const skipped: Array<[number, string]> = [];

beforeAll(() => {
	set_echo(true);
	// Content code logs on purpose (failed evaluations, unknown components): keep the run readable.
	for (const m of ['log', 'warn', 'error', 'info', 'debug'] as const) vi.spyOn(console, m).mockImplementation(() => {});
	// Nothing in a server render may reach the network (a Symbol without content would fetch).
	vi.stubGlobal('fetch', () => Promise.reject(new Error('fuzz: no network')));
});

afterAll(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	set_plain(true);
	const out: string[] = [];
	if (official_crashes.length) {
		out.push(`[fuzz] the official SDK threw on ${official_crashes.length} seed(s):`);
		const by_msg = new Map<string, number[]>();
		for (const [seed, msg] of official_crashes) by_msg.set(msg, [...(by_msg.get(msg) ?? []), seed]);
		for (const [msg, s] of by_msg) {
			const repro = crash_repro.get(msg)!;
			out.push(`  ${msg}  (seeds ${s.slice(0, 8).join(', ')}${s.length > 8 ? ', …' : ''})`);
			out.push(`    minimal: ${JSON.stringify(repro.spec)}`);
			out.push(`    ours on it: ${repro.ours}`);
		}
	}
	if (skipped.length) {
		out.push(`[fuzz] ${skipped.length} seed(s) passed only modulo a known difference (tests/fuzz/known.ts, check.ts):`);
		const by = new Map<string, number[]>();
		for (const [seed, why] of skipped) by.set(why, [...(by.get(why) ?? []), seed]);
		for (const [why, s] of by) out.push(`  ${why}  (seeds ${s.slice(0, 8).join(', ')}${s.length > 8 ? ', …' : ''})`);
	}
	if (out.length) process.stdout.write(out.join('\n') + '\n');
});

function same_class(a: Failure, b: Failure | null): boolean {
	return !!b && a.kind === b.kind;
}

describe('fuzz: both SDKs render random content the same', () => {
	for (const seed of seeds) {
		it(`seed ${seed}`, () => {
			const spec = neutralize(generate(seed));
			const result = check(spec);
			if (result.official_error !== undefined) {
				const msg = result.official_error;
				official_crashes.push([seed, msg]);
				// The first seed of each crash: shrunk, so the summary shows what makes the official SDK throw.
				if (!crash_repro.has(msg)) {
					const min = shrink(spec, (s) => check(s).official_error === msg, 1500);
					crash_repro.set(msg, { spec: min, ours: check(min).ours_error ?? 'renders' });
				}
				return;
			}
			const failure = result.failure;
			if (result.note) skipped.push([seed, result.note]);
			if (!failure) return;
			const why = known_official(spec, failure);
			if (why) {
				skipped.push([seed, why]);
				return;
			}
			const min: Spec = shrink(spec, (s) => {
				const r = check(s);
				return same_class(failure, r.failure) && !known_official(s, r.failure!);
			});
			const min_failure = check(min).failure ?? failure;
			const message =
				`seed ${seed}: ${failure.kind} (shrunk ${size_of(spec)} → ${size_of(min)} bytes)\n` +
				`${min_failure.detail}\n` +
				`minimal spec (FUZZ_SEED=${seed} reproduces):\n${JSON.stringify(min)}`;
			expect.fail(message);
		});
	}
});
