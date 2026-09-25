// Browser CPU profile of one page load (hydration included), summarized by function and by file.
//   node bench/client-profile.mjs <ours|official> <fixture-name> [throttle]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const [, , sdk = 'ours', name, throttle = '4'] = process.argv;
const port = 4450;
const server = spawn(process.execPath, [path.join(ROOT, `e2e/app/build-${sdk}`)], { env: { ...process.env, PORT: String(port), FIXTURES_DIR: path.join(ROOT, 'fixtures') }, stdio: 'ignore' });
try {
	for (let i = 0; i < 100; i++) { try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.goto(`http://localhost:${port}/bench/${name}`); // warm server + http cache
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(throttle) });
	await cdp.send('Profiler.enable');
	await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
	await cdp.send('Profiler.start');
	await page.goto(`http://localhost:${port}/bench/${name}`);
	await page.waitForFunction(() => window.__hydrated !== undefined);
	const { profile } = await cdp.send('Profiler.stop');
	await browser.close();
	const dt = new Map();
	for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));
	const by_fn = new Map(), by_file = new Map();
	let total = 0;
	for (const n of profile.nodes) {
		const t = dt.get(n.id) ?? 0;
		if (n.callFrame.functionName === '(idle)') continue;
		total += t;
		const file = n.callFrame.url.split('/').pop() || n.callFrame.functionName;
		by_file.set(file, (by_file.get(file) ?? 0) + t);
		const k = `${n.callFrame.functionName || '(anon)'} ${file}:${n.callFrame.lineNumber + 1}`;
		by_fn.set(k, (by_fn.get(k) ?? 0) + t);
	}
	console.log(`busy ${(total / 1000).toFixed(1)} ms at ${throttle}x`);
	for (const [k, t] of [...by_file].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('  file', (t / 1000).toFixed(1).padStart(7), 'ms', k);
	for (const [k, t] of [...by_fn].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log('  fn  ', (t / 1000).toFixed(1).padStart(7), 'ms', k);
} finally {
	server.kill();
}
