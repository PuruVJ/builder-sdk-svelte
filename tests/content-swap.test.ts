// A new `content` object with the same id must re-render, in both SDKs (e2e/app/src/routes/swap).
// Needs `pnpm e2e:build`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SDKS = { official: 4411, ours: 4412 } as const;
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

describe.skipIf(!built)('<Content> follows a new content object with the same id', () => {
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
		it(sdk, async () => {
			const page = await browser.newPage();
			await page.goto(`http://localhost:${port}/swap`);
			const blocks = page.locator('[builder-content-id="swap-content"] .builder-block');
			await expect.poll(() => blocks.count()).toBe(1);

			await page.locator('[data-show-full]').click();
			await expect.poll(() => blocks.count()).toBe(10);

			await page.evaluate(() => ((window as any).__kept = document.querySelector('[builder-content-id="swap-content"] .builder-block')));
			await page.locator('[data-show-same]').click();
			await page.waitForTimeout(100);
			expect(await blocks.count()).toBe(10);
			if (sdk === 'ours') {
				const same = await page.evaluate(() => (window as any).__kept === document.querySelector('[builder-content-id="swap-content"] .builder-block'));
				expect(same).toBe(true);
			}
			await page.close();
		});
	}
});
