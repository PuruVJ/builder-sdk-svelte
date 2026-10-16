// A container component rendered as an island (csr=false pages): its server HTML carries the page's
// scope, then it hydrates alone with no <Content> above it. The nested blocks must survive, as the same
// nodes (e2e/app/src/routes/island). Needs `pnpm e2e:build`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SDKS = { official: 4441, ours: 4442 } as const;
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

describe.skipIf(!built)('a container hydrated as an island', () => {
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

	for (const [sdk, port] of Object.entries(SDKS)) for (const wrapper of ['', 'section']) {
		it(`${sdk}${wrapper ? ` (${wrapper} wrapper)` : ''}: the nested blocks stay, as the same nodes, and the island is live`, async () => {
			const page = await browser.newPage();
			const scripts: string[] = [];
			page.on('response', async (r) => {
				if (r.url().endsWith('.js')) scripts.push(await r.text().catch(() => ''));
			});
			await page.goto(`http://localhost:${port}/island${wrapper ? `?wrapper=${wrapper}` : ''}`);
			await page.waitForFunction(() => (window as any).__hydrated || (window as any).__hydrate_error, null, { timeout: 10_000 });
			await page.waitForTimeout(1000);
			const state = await page.evaluate(() => {
				const w = window as any;
				const island = document.querySelector('[data-island]')!;
				const before = w.__before as Element[];
				const after = [...island.querySelectorAll('[builder-id]')];
				return {
					error: w.__hydrate_error ?? null,
					before: before.length,
					after: after.length,
					same: before.every((n, i) => n === after[i] && n.isConnected),
					text: island.querySelector('[data-text]')?.textContent,
					leaf: island.querySelector('[data-leaf]')?.textContent,
					deep: island.querySelector('[data-deep]')?.textContent
				};
			});
			expect(state.error).toBeNull();
			expect(state.before).toBeGreaterThanOrEqual(4);
			expect(state.after).toBe(state.before);
			expect(state.same).toBe(true);
			expect([state.text, state.leaf, state.deep]).toEqual(['nested text', 'nested leaf', 'deep text']);
			await page.locator('[data-island] [data-bump]').click();
			await expect.poll(() => page.locator('[data-island] [data-bump]').textContent()).toBe('1');
			if (sdk === 'ours') expect(scripts.some((s) => s.includes('builder.sdkInfo'))).toBe(false);
			await page.close();
		});
	}
});
