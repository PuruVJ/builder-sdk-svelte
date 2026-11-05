// Inside the editor: a custom component that throws while it is being edited empties only its own
// block (the page and its neighbours stay up) and comes back on its next edit; an edited Custom Code
// block runs its new scripts (official onUpdate). (e2e/app/src/routes/editor-resilience; ours only —
// the official SDK has no per-block boundary.) Needs `pnpm e2e:build`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resilience_content } from '../e2e/app/src/routes/editor-resilience/content.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 4481;
const built = fs.existsSync(path.join(ROOT, 'e2e/app/build-ours'));

let browser: Browser;
let server: ChildProcess | undefined;

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

async function open(): Promise<{ page: Page; frame: Frame; errors: string[] }> {
	const page = await browser.newPage();
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	const editor = `http://localhost:${PORT}/__editor`;
	await page.route(editor, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
	await page.goto(editor);
	const ready = page.evaluate(() => new Promise<void>((resolve) => addEventListener('message', (e) => e.data?.type === 'builder.sdkInfo' && resolve())));
	await page.evaluate((src) => {
		const frame = document.createElement('iframe');
		frame.src = src;
		document.body.append(frame);
	}, `http://localhost:${PORT}/editor-resilience?builder.frameEditing=page`);
	await ready;
	const frame = page.frames().find((f) => f.url().includes('/editor-resilience'))!;
	await frame.waitForSelector('[data-boom]');
	return { page, frame, errors };
}

const update = (frame: Frame, content: unknown) =>
	frame.evaluate((content) => window.postMessage({ type: 'builder.contentUpdate', data: { key: 'page', data: content } }, '*'), content);

describe.skipIf(!built)('the editor survives what is being edited', () => {
	beforeAll(async () => {
		server = spawn(process.execPath, [path.join(ROOT, 'e2e/app/build-ours')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
		await up(PORT);
		browser = await chromium.launch();
	});
	afterAll(async () => {
		await browser?.close();
		server?.kill();
	});

	it('a component that throws empties only its block, and comes back on its next edit', async () => {
		const { page, frame, errors } = await open();
		try {
			const logged: string[] = [];
			frame.page().on('console', (m) => m.type() === 'error' && logged.push(m.text()));
			await update(frame, resilience_content({ boom: true }));
			await frame.waitForSelector('[data-boom]', { state: 'detached' });
			// the rest of the page is up, and still editable
			expect(await frame.locator('[data-neighbour]').textContent()).toBe('neighbour');
			const next = resilience_content({ boom: true });
			(next.data.blocks[1].component as { options: { text: string } }).options.text = '<p data-neighbour>edited</p>';
			await update(frame, next);
			await frame.waitForFunction(() => document.querySelector('[data-neighbour]')?.textContent === 'edited');
			// the failure is reported, not thrown into the page
			expect(logged.some((t) => t.includes('a component failed to render'))).toBe(true);
			expect(errors).toEqual([]);
			// fixed in the editor: it renders again
			await update(frame, resilience_content({ boom: false }));
			await frame.waitForFunction(() => document.querySelector('[data-boom]')?.textContent === 'boom ok');
		} finally {
			await page.close();
		}
	}, 60_000);

	it('edited Custom Code runs its new scripts, each once', async () => {
		const { page, frame, errors } = await open();
		try {
			await frame.waitForFunction(() => ((window as any).__code_runs ?? []).includes('v1'));
			await update(frame, resilience_content({ code: '<p data-code>v2</p><script>window.__code_runs = (window.__code_runs || []).concat("v2")</script>' }));
			await frame.waitForFunction(() => ((window as any).__code_runs ?? []).includes('v2'));
			await frame.waitForTimeout(300);
			const runs = await frame.evaluate(() => (window as any).__code_runs as string[]);
			// v1 ran on the static page and again in the live view (the page re-renders live in the editor); v2 once
			expect(runs.filter((r) => r === 'v2')).toEqual(['v2']);
			expect(await frame.locator('[data-code]').textContent()).toBe('v2');
			expect(errors).toEqual([]);
		} finally {
			await page.close();
		}
	}, 60_000);
});
