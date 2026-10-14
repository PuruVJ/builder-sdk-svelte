// Inside the official tree (editor / preview), a component rendering children through our `Blocks`
// hands off to the official one instead of an empty wrapper (e2e/app/src/routes/nested-official).
// Needs `pnpm e2e:build`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SDKS = { official: 4421, ours: 4422 } as const;
const built = Object.keys(SDKS).every((sdk) => fs.existsSync(path.join(ROOT, `e2e/app/build-${sdk}`)));

let browser: Browser;
const servers: ChildProcess[] = [];

async function up(port: number) {
	for (let i = 0; i < 100; i++) {
		try {
			await fetch(`http://localhost:${port}/`);
			return;
		} catch {
			await new Promise((r) => setTimeout(r, 100));
		}
	}
	throw new Error(`no server on ${port}`);
}

describe.skipIf(!built)('<Blocks> inside the official tree', () => {
	beforeAll(async () => {
		for (const [sdk, port] of Object.entries(SDKS)) {
			servers.push(spawn(process.execPath, [path.join(ROOT, `e2e/app/build-${sdk}`)], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' }));
			await up(port);
		}
		browser = await chromium.launch();
	});
	afterAll(async () => {
		await browser?.close();
		for (const s of servers) s.kill();
	});

	for (const [sdk, port] of Object.entries(SDKS)) {
		it(`${sdk}: the nested child renders, and stays`, async () => {
			const page = await browser.newPage();
			await page.goto(`http://localhost:${port}/nested-official`);
			await page.waitForSelector('[data-container] [data-child]', { timeout: 10_000 });
			await page.waitForTimeout(1500);
			expect(await page.locator('[data-container] [data-child]').textContent()).toBe('nested child');
			await page.close();
		});
	}
});
