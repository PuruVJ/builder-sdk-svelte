/**
 * `pnpm bench:count`: every counted bench, two runs into one report (Svelte compiles a process's
 * components one way), <out-dir>/report.json (what `heisenbench diff` compares):
 *   server  bench/count/{ssr,app-page,live}.bench.ts
 *   client  bench/count/client.bench.ts, `--svelte client` on a DOM (bench/count/dom.ts), `--append`ed
 * Both resolve packages with the `svelte` condition, as vite-plugin-svelte does for this repo's builds
 * (the official SDK's `exports` then give the build a SvelteKit app renders, `lib/browser`).
 *   node bench/count/run.ts [--out-dir bench/results/heisenbench] [--source-from sha] [--filter text]
 * Needs `pnpm fixtures && pnpm bench:build` first (the inputs, and the server HTML the client hydrates).
 * `--source-from <sha>` counts these bench files on that commit's code (a PR whose base has none).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: { 'out-dir': { type: 'string' }, 'source-from': { type: 'string' }, filter: { type: 'string' } } });
const out = path.resolve(values['out-dir'] ?? path.join(ROOT, 'bench/results/heisenbench'));
fs.mkdirSync(out, { recursive: true });
const report = path.join(out, 'report.json');
const extra = [
	'--conditions',
	'svelte',
	...(values['source-from'] ? ['--source-from', values['source-from']] : []),
	...(values.filter ? ['--filter', values.filter] : [])
];
const SERVER = ['ssr', 'app-page', 'live'].map((f) => `bench/count/${f}.bench.ts`);
const cli = path.join(ROOT, 'node_modules/heisenbench', JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/heisenbench/package.json'), 'utf8')).bin.heisenbench);

const run = (args: string[]) => spawnSync(process.execPath, [cli, 'run', ...args, '--out', report, ...extra], { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
const server = run(SERVER);
const client = run(['bench/count/client.bench.ts', '--svelte', 'client', '--import', 'bench/count/dom.ts', '--append']);
process.exit(server || client);
