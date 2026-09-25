// CLIENT BENCH: the browser cost of each SDK on a Kit page that server-renders Builder content and
// HYDRATES it (csr=true, like the field app). Real Chromium via Playwright; each fixture × SDK is
// loaded RUNS times in a fresh context, at 1× and 4× CPU throttle; medians are reported.
//   node bench/client.mjs [fixture-name ...]   (names like real__fr-fr.pageContent, gen__flat-1000)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RUNS = Number(process.env.RUNS ?? 5);
const THROTTLES = (process.env.THROTTLES ?? '1,4').split(',').map(Number);
const fixtures = process.argv.slice(2);
const SDKS = { official: 4401, ours: 4402 };

function start(sdk, port) {
	const p = spawn(process.execPath, [path.join(ROOT, `e2e/app/build-${sdk}`)], {
		env: { ...process.env, PORT: String(port), FIXTURES_DIR: path.join(ROOT, 'fixtures') },
		stdio: 'ignore'
	});
	return p;
}
async function wait_up(port) {
	for (let i = 0; i < 100; i++) {
		try {
			await fetch(`http://localhost:${port}/`);
			return;
		} catch {
			await new Promise((r) => setTimeout(r, 100));
		}
	}
	throw new Error('server did not start on ' + port);
}

const median = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
};

async function measure(browser, port, name, throttle) {
	const context = await browser.newContext();
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await cdp.send('Performance.enable');
	if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
	await page.addInitScript(() => {
		window.__lt = [];
		new PerformanceObserver((l) => {
			for (const e of l.getEntries()) window.__lt.push(e.duration);
		}).observe({ type: 'longtask', buffered: true });
	});
	const res = await page.goto(`http://localhost:${port}/bench/${name}`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__hydrated !== undefined, null, { timeout: 60000 });
	await page.waitForTimeout(200);
	const page_metrics = await page.evaluate(() => {
		const nav = performance.getEntriesByType('navigation')[0];
		const scripts = performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'script' || r.name.endsWith('.js'));
		return {
			hydrated_ms: window.__hydrated,
			long_tasks_ms: window.__lt.reduce((a, b) => a + b, 0),
			tbt_ms: window.__lt.reduce((a, b) => a + Math.max(0, b - 50), 0),
			dom_nodes: document.getElementsByTagName('*').length,
			html_transfer: nav.transferSize,
			html_decoded: nav.decodedBodySize,
			js_transfer: scripts.reduce((a, r) => a + r.transferSize, 0),
			js_decoded: scripts.reduce((a, r) => a + r.decodedBodySize, 0)
		};
	});
	await cdp.send('HeapProfiler.collectGarbage');
	const { metrics } = await cdp.send('Performance.getMetrics');
	const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
	await context.close();
	return {
		status: res?.status(),
		...page_metrics,
		script_ms: m.ScriptDuration * 1000,
		task_ms: m.TaskDuration * 1000,
		layout_ms: m.LayoutDuration * 1000,
		heap_bytes: m.JSHeapUsedSize
	};
}

const servers = Object.entries(SDKS).map(([sdk, port]) => start(sdk, port));
try {
	await Promise.all(Object.values(SDKS).map(wait_up));
	const browser = await chromium.launch({ headless: true });
	const results = [];
	for (const name of fixtures) {
		for (const throttle of THROTTLES) {
			for (const [sdk, port] of Object.entries(SDKS)) {
				await measure(browser, port, name, throttle); // warm the server + browser caches
				const runs = [];
				for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, port, name, throttle));
				const row = { fixture: name, sdk, throttle };
				for (const k of Object.keys(runs[0])) row[k] = median(runs.map((r) => r[k]));
				results.push(row);
				console.log(JSON.stringify(row));
			}
		}
	}
	await browser.close();
	fs.mkdirSync(path.join(ROOT, 'bench/results'), { recursive: true });
	fs.writeFileSync(path.join(ROOT, 'bench/results/client.json'), JSON.stringify(results, null, 1));
} finally {
	for (const s of servers) s.kill();
}
