// The bugs earlier releases fixed, re-checked where the editor bridge now lives — inside the Builder
// editor and in a preview, through both SDKs:
//  - 0.0.6: a container's children rendered through the app's <Blocks> show, stay, and follow edits;
//  - 0.0.5: a new content object with the same id grows the page — and, live, merges in without
//    remounting anything (official mergeNewContent), the editor's edits still apply on top;
//  - 0.0.10: custom elements in blocks an edit did not touch are never disconnected;
//  - 0.0.8 / 0.0.9: a container hydrated alone (an island) keeps the server's nodes, editor or preview.
// (e2e/app/src/routes/live-regressions and island.) Needs `pnpm e2e:build`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { regressions_content } from '../e2e/app/src/routes/live-regressions/content.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SDKS = { official: 4491, ours: 4492 } as const;
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

/** `route` inside an editor-shaped parent frame, once the SDK announced itself. */
async function in_editor(port: number, route: string): Promise<{ page: Page; frame: Frame; errors: string[] }> {
	const page = await browser.newPage();
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	const editor = `http://localhost:${port}/__editor`;
	await page.route(editor, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
	await page.goto(editor);
	const ready = page.evaluate(() => new Promise<void>((resolve) => addEventListener('message', (e) => e.data?.type === 'builder.sdkInfo' && resolve())));
	await page.evaluate((src) => {
		const frame = document.createElement('iframe');
		frame.src = src;
		frame.style.cssText = 'width:1000px;height:800px';
		document.body.append(frame);
	}, `http://localhost:${port}${route}${route.includes('?') ? '&' : '?'}builder.frameEditing=page`);
	await ready;
	const frame = page.frames().find((f) => f.url().includes(route.split('?')[0]))!;
	return { page, frame, errors };
}

const update = (frame: Frame, content: unknown) =>
	frame.evaluate((content) => window.postMessage({ type: 'builder.contentUpdate', data: { key: 'page', data: content } }, '*'), content);
const text = (frame: Frame, selector: string) => frame.locator(selector).first().textContent();

describe.skipIf(!built)('earlier fixes, inside the editor and in a preview', () => {
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
		it(`${sdk}: a container's nested blocks show, stay and follow edits in the editor (0.0.6)`, async () => {
			const { page, frame, errors } = await in_editor(port, '/live-regressions');
			try {
				await frame.waitForSelector('[data-box] [data-nested]');
				await frame.waitForTimeout(500);
				expect(await text(frame, '[data-box] [data-nested]')).toBe('nested child');
				await update(frame, regressions_content({ nested: 'edited child' }));
				await frame.waitForFunction(() => document.querySelector('[data-box] [data-nested]')?.textContent === 'edited child');
				expect(errors).toEqual([]);
			} finally {
				await page.close();
			}
		});

		it(`${sdk}: a container's nested blocks show and stay in a preview (0.0.6)`, async () => {
			const page = await browser.newPage();
			const errors: string[] = [];
			page.on('pageerror', (e) => errors.push(e.message));
			try {
				await page.goto(`http://localhost:${port}/live-regressions?builder.preview=page`);
				await page.waitForSelector('[data-box] [data-nested]');
				await page.waitForTimeout(800);
				expect(await page.locator('[data-box] [data-nested]').textContent()).toBe('nested child');
				expect(errors).toEqual([]);
			} finally {
				await page.close();
			}
		});

		it(`${sdk}: a new content object with the same id grows the page in the editor, and edits still apply (0.0.5)`, async () => {
			const { page, frame, errors } = await in_editor(port, '/live-regressions');
			try {
				await frame.waitForSelector('[data-counter]');
				await frame.waitForTimeout(500);
				await frame.locator('[data-counter]').click();
				await frame.waitForFunction(() => document.querySelector('[data-counter]')?.textContent?.trim() === 'count 1');
				const mounts = await frame.evaluate(() => (window as any).__counter_mounts);
				await frame.locator('[data-swap]').click();
				await frame.waitForFunction(() => document.querySelectorAll('[data-extra]').length === 2);
				if (sdk === 'ours') {
					// merged in, not remounted: the component kept its state
					expect(await frame.evaluate(() => (window as any).__counter_mounts)).toBe(mounts);
					expect((await text(frame, '[data-counter]'))?.trim()).toBe('count 1');
				}
				await update(frame, regressions_content({ nested: 'after swap', extra: 2 }));
				await frame.waitForFunction(() => document.querySelector('[data-nested]')?.textContent === 'after swap');
				expect(await frame.locator('[data-extra]').count()).toBe(2);
				expect(errors).toEqual([]);
			} finally {
				await page.close();
			}
		});
	}

	it('ours: an edit never disconnects custom elements in blocks it did not touch (0.0.10)', async () => {
		const { page, frame, errors } = await in_editor(SDKS.ours, '/live-regressions');
		try {
			await frame.waitForSelector('[data-top] x-probe', { state: 'attached' });
			await frame.waitForTimeout(500);
			const before = await frame.evaluate(() => ({ ...(window as any).__probe }));
			// the Box's nested text changes; the top block (and its custom element) does not
			await update(frame, regressions_content({ nested: 'edited child' }));
			await frame.waitForFunction(() => document.querySelector('[data-nested]')?.textContent === 'edited child');
			await frame.waitForTimeout(200);
			const after = await frame.evaluate(() => ({ ...(window as any).__probe }));
			// the edited block's element is replaced (its HTML changed) — one out, one in; nothing else moves
			expect(after.disconnect - before.disconnect).toBeLessThanOrEqual(1);
			expect(await frame.evaluate(() => document.querySelectorAll('x-probe').length)).toBe(2);
			expect(errors).toEqual([]);
		} finally {
			await page.close();
		}
	});

	for (const [sdk, port] of Object.entries(SDKS))
		for (const mode of ['editor', 'preview'] as const) {
			it(`${sdk}: a container hydrated alone keeps the server's nodes, ${mode} (0.0.8 / 0.0.9)`, async () => {
				let page: Page;
				let frame: Frame;
				const errors: string[] = [];
				if (mode === 'editor') {
					// (an island page has no <Content> in the browser: nothing announces itself to the editor)
					page = await browser.newPage();
					page.on('pageerror', (e) => errors.push(e.message));
					await page.goto(`http://localhost:${port}/island?builder.frameEditing=page`);
					frame = page.mainFrame();
				} else {
					page = await browser.newPage();
					page.on('pageerror', (e) => errors.push(e.message));
					await page.goto(`http://localhost:${port}/island?builder.preview=page`);
					frame = page.mainFrame();
				}
				try {
					await frame.waitForFunction(() => (window as any).__hydrated || (window as any).__hydrate_error, null, { timeout: 10_000 });
					await frame.waitForTimeout(800);
					const state = await frame.evaluate(() => {
						const w = window as any;
						const island = document.querySelector('[data-island]')!;
						const before = w.__before as Element[];
						const after = [...island.querySelectorAll('[builder-id]')];
						return { error: w.__hydrate_error ?? null, before: before.length, same: before.every((n, i) => n === after[i] && n.isConnected) };
					});
					expect(state.error).toBeNull();
					expect(state.before).toBeGreaterThanOrEqual(4);
					expect(state.same).toBe(true);
					expect(errors).toEqual([]);
				} finally {
					await page.close();
				}
			});
		}
});
