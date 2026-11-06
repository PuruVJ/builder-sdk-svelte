// "+ Add Block" in an empty block list: inside the editor, clicking (or a key press on) an empty
// <Blocks> posts `builder.clickEmptyBlocks` and hovering it `builder.hoverEmptyBlocks`, with its
// parent id and data path — the same messages as the official SDK. Outside the editor, nothing.
// (e2e/app/src/routes/empty-blocks: an empty custom slot, an empty column, a `section` wrapper.)
// Needs `pnpm e2e:build`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SDKS = { official: 4461, ours: 4462 } as const;
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

type Message = { type: string; data?: unknown };
const EMPTY = ['builder.clickEmptyBlocks', 'builder.hoverEmptyBlocks'];

/** Hover, click and key-press every block list on the page; the empty-list messages that came of it. */
async function poke(frame: Frame, read: () => Promise<Message[]>) {
	await frame.evaluate(() => {
		for (const el of document.querySelectorAll('.builder-blocks')) {
			el.dispatchEvent(new MouseEvent('mouseenter'));
			(el as HTMLElement).click();
			el.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'Enter' }));
		}
	});
	await frame.waitForTimeout(300);
	return (await read()).filter((m) => EMPTY.includes(m?.type));
}

async function in_editor(port: number): Promise<{ page: Page; messages: Message[] }> {
	const page = await browser.newPage();
	const editor = `http://localhost:${port}/__editor`;
	await page.route(editor, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
	await page.goto(editor);
	const ready = page.evaluate(() => {
		(window as any).__messages = [];
		addEventListener('message', (e) => (window as any).__messages.push(e.data));
		return new Promise<void>((resolve) => addEventListener('message', (e) => e.data?.type === 'builder.sdkInfo' && resolve()));
	});
	await page.evaluate((src) => {
		const frame = document.createElement('iframe');
		frame.src = src;
		document.body.append(frame);
	}, `http://localhost:${port}/empty-blocks?builder.frameEditing=page`);
	await ready;
	const frame = page.frames().find((f) => f.url().includes('/empty-blocks'))!;
	await frame.waitForSelector('[data-tab="builder-s-tab"] .builder-blocks', { state: 'attached' });
	await page.waitForTimeout(500);
	const messages = await poke(frame, () => page.evaluate(() => (window as any).__messages));
	return { page, messages };
}

describe.skipIf(!built)('empty block lists in the editor', () => {
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

	it('inside the editor: the same "+ Add Block" messages as the official SDK', async () => {
		const official = await in_editor(SDKS.official);
		const ours = await in_editor(SDKS.ours);
		try {
			// every empty list (2 per content: the tab, the column) × hover + click + key press
			expect(official.messages.length).toBe(4 * 3);
			expect(ours.messages).toEqual(official.messages);
			expect(ours.messages).toContainEqual({
				type: 'builder.clickEmptyBlocks',
				data: { parentElementId: 'builder-p-tab', dataPath: 'component.options.content' }
			});
		} finally {
			await official.page.close();
			await ours.page.close();
		}
	});

	for (const [sdk, port] of Object.entries(SDKS)) {
		it(`${sdk}: outside the editor, an empty list posts nothing`, async () => {
			const page = await browser.newPage();
			await page.goto(`http://localhost:${port}/empty-blocks`);
			await page.waitForSelector('[data-tab="builder-s-tab"] .builder-blocks', { state: 'attached' });
			await page.evaluate(() => {
				(window as any).__messages = [];
				addEventListener('message', (e) => (window as any).__messages.push(e.data));
			});
			const messages = await poke(page.mainFrame(), () => page.evaluate(() => (window as any).__messages));
			expect(messages).toEqual([]);
			await page.close();
		});
	}
});
