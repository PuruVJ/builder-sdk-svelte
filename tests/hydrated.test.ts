// A page whose Builder content hydrates (e2e/app/src/routes/hydrated): a custom element upgraded before
// hydration must never be disconnected by it. Needs `pnpm e2e:build`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 4443;
const built = fs.existsSync(path.join(ROOT, 'e2e/app/build-ours'));

let browser: Browser;
let server: ChildProcess;

describe.skipIf(!built)('hydrating Builder content', () => {
	beforeAll(async () => {
		server = spawn(process.execPath, [path.join(ROOT, 'e2e/app/build-ours')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
		for (let i = 0; i < 100; i++) {
			try {
				await fetch(`http://localhost:${PORT}/`);
				break;
			} catch {
				await new Promise((r) => setTimeout(r, 100));
			}
		}
		browser = await chromium.launch();
	});
	afterAll(async () => {
		await browser?.close();
		server?.kill();
	});

	it('the custom elements in the content, a nested <Blocks> and a column are never disconnected', async () => {
		const page = await browser.newPage();
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		await page.goto(`http://localhost:${PORT}/hydrated`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(500);
		const probe = await page.evaluate(() => (window as any).__probe);
		expect(errors).toEqual([]);
		expect(probe).toEqual({ connect: 3, disconnect: 0 });
		await page.close();
	});
});
