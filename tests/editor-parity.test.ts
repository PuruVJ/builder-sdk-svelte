// The editor sees the same app through either SDK: the messages it receives inside its frame, and
// the BuilderContext custom components read (e2e/app/src/routes/editor). Needs `pnpm e2e:build`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SDKS = { official: 4431, ours: 4432 } as const;
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

type Message = { type: string; data?: any };

/** The page in an editor-shaped frame: every message it posts to its parent, and the frame. */
async function in_editor(port: number) {
	const page = await browser.newPage();
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	// (same origin as the frame: Chrome blocks a public page framing localhost)
	const editor = `http://localhost:${port}/__editor`;
	await page.route(editor, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
	await page.goto(editor);
	await page.evaluate((src) => {
		(window as any).__messages = [];
		addEventListener('message', (e) => (window as any).__messages.push(e.data));
		const frame = document.createElement('iframe');
		frame.src = src;
		document.body.append(frame);
	}, `http://localhost:${port}/editor?builder.frameEditing=page`);
	const frame = page.frameLocator('iframe');
	await frame.locator('[data-ctx="editor-test"]').waitFor({ timeout: 10_000 });
	await frame.locator('[data-ctx="header-test"]').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(1000);
	const messages = (await page.evaluate(() => (window as any).__messages)) as Message[];
	return { page, frame, messages, errors };
}

/** A serialized function, without the minifier's per-build one-letter names. */
const FN_ARGS = /\b[a-zA-Z_$]\b/g;
const normalize = (value: unknown): unknown =>
	JSON.parse(JSON.stringify(value), (_k, v) => (typeof v === 'string' && v.startsWith('return (') ? v.replace(FN_ARGS, '_') : v));
const of_type = (messages: Message[], type: string) => normalize(messages.filter((m) => m?.type === type));

describe.skipIf(!built)('the editor sees the same app', () => {
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

	it('a custom component reads BuilderContext outside the editor', async () => {
		const infos: unknown[] = [];
		for (const port of Object.values(SDKS)) {
			const page = await browser.newPage();
			await page.goto(`http://localhost:${port}/editor`);
			await page.locator('[data-ctx="editor-test"]').waitFor({ timeout: 10_000 });
			await page.locator('[data-ctx="header-test"]').waitFor({ timeout: 10_000 });
			const info = JSON.parse((await page.locator('[data-ctx="editor-test"]').getAttribute('data-info'))!);
			expect(info.inputs[1].showIf).toMatch(/^return \(/);
			infos.push(info);
			await page.close();
		}
		expect(infos[1]).toEqual(infos[0]);
	});

	it('inside the editor frame: the same messages, the same context, no errors', async () => {
		const official = await in_editor(SDKS.official);
		const ours = await in_editor(SDKS.ours);
		try {
			for (const run of [official, ours]) {
				expect(run.errors).toEqual([]);
				expect(of_type(run.messages, 'builder.sdkInfo')).toHaveLength(1);
				const ctx = of_type(run.messages, 'builder.registerComponent').find((m) => m.data?.name === 'Ctx');
				expect(ctx?.data.inputs[1].showIf).toMatch(/^return \(/);
			}
			const kinds = (run: { messages: Message[] }) => run.messages.map((m) => m?.type + (m?.data?.name ? ':' + m.data.name : ''));
			expect(kinds(ours)).toEqual(kinds(official));
			for (const type of ['builder.sdkInfo', 'builder.registerComponent', 'builder.register', 'builder.registerAction', 'builder.settingsChange']) {
				expect(of_type(ours.messages, type), type).toEqual(of_type(official.messages, type));
			}
		} finally {
			await official.page.close();
			await ours.page.close();
		}
	});
});
