/**
 * The client run of the counted benches: bench/count/client.bench.ts with `.svelte` compiled as client
 * output. The `heisenbench` CLI compiles components as server output and has no flag for this yet, so
 * this calls its API (the same runner) with `svelte: 'client'`.
 *   node --import ./bench/count/dom.ts --import ./bench/count/resolve.ts bench/count/client.ts \
 *     [--out file.json] [--source-from sha]
 */
import { parseArgs } from 'node:util';
import { runBenches } from 'heisenbench';

const { values } = parseArgs({ options: { out: { type: 'string' }, 'source-from': { type: 'string' }, filter: { type: 'string' } } });
const report = await runBenches({
	files: ['bench/count/client.bench.ts'],
	svelte: 'client',
	out: values.out ?? 'bench/results/heisenbench-client.json',
	source_from: values['source-from'],
	filter: values.filter,
	log: (line: string) => console.log(line)
});
const failed = report.cases.filter((c) => c.error || !c.stable).length + (report.load_errors?.length ?? 0);
process.exit(failed ? 1 : 0);
