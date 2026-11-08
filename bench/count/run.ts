/**
 * `pnpm bench:count`: every counted bench, two runs (Svelte compiles a process's components one way):
 *   server  bench/count/{ssr,app-page,live}.bench.ts  →  <out-dir>/server.json
 *   client  bench/count/client.bench.ts               →  <out-dir>/client.json
 * and both in one report, <out-dir>/report.json (what `heisenbench diff` compares).
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
const extra = [
	...(values['source-from'] ? ['--source-from', values['source-from']] : []),
	...(values.filter ? ['--filter', values.filter] : [])
];
const SERVER = ['ssr', 'app-page', 'live'].map((f) => `bench/count/${f}.bench.ts`);
const cli = path.join(ROOT, 'node_modules/heisenbench', JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/heisenbench/package.json'), 'utf8')).bin.heisenbench);

const run = (args: string[]) => spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
const server = run([cli, 'run', ...SERVER, '--import', 'bench/count/resolve.ts', '--out', path.join(out, 'server.json'), ...extra]);
const client = run(['--import', './bench/count/dom.ts', '--import', './bench/count/resolve.ts', 'bench/count/client.ts', '--out', path.join(out, 'client.json'), ...extra]);

// One report: the same commit, prices and Node on both runs, so the cases simply add up.
const read = (name: string) => (fs.existsSync(path.join(out, name)) ? JSON.parse(fs.readFileSync(path.join(out, name), 'utf8')) : null);
const [s, c] = [read('server.json'), read('client.json')];
const both = s && c ? { ...s, cases: [...s.cases, ...c.cases], load_errors: [...(s.load_errors ?? []), ...(c.load_errors ?? [])] } : (s ?? c);
if (both) fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(both));
process.exit(server || client);
