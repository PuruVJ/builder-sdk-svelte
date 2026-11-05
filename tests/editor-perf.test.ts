// What one editor edit costs on a page of hundreds of custom components (e2e/app/src/routes/editor-perf):
// how many components get new props, how many remount, and how long until the edit is on screen —
// at full speed and with the CPU slowed 6× (a low-end Windows laptop). Needs `pnpm e2e:build`.
//
// The official SDK's numbers are measured and printed for comparison; only ours is held to a budget.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { perf_content } from '../e2e/app/src/routes/editor-perf/content.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SDKS = { official: 4441, ours: 4442 } as const;
const built = Object.keys(SDKS).every((sdk) => fs.existsSync(path.join(ROOT, `e2e/app/build-${sdk}`)));
const SECTIONS = 100; // 100 sections × 3 Cards = 300 custom components

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

type Content = ReturnType<typeof perf_content>;
const clone = (c: Content): Content => JSON.parse(JSON.stringify(c));

/** The page inside an editor-shaped frame, set up for editing. */
async function open(port: number, cpu = 1): Promise<{ page: Page; frame: Frame; errors: string[] }> {
	const page = await browser.newPage();
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	const editor = `http://localhost:${port}/__editor`;
	await page.route(editor, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0"></body>' }));
	await page.goto(editor);
	const ready = page.evaluate(
		() => new Promise<void>((resolve) => addEventListener('message', (e) => e.data?.type === 'builder.sdkInfo' && resolve()))
	);
	await page.evaluate((src) => {
		const frame = document.createElement('iframe');
		frame.src = src;
		frame.style.cssText = 'width:1200px;height:900px;border:0';
		document.body.append(frame);
	}, `http://localhost:${port}/editor-perf?n=${SECTIONS}&builder.frameEditing=page`);
	await ready;
	const frame = page.frames().find((f) => f.url().includes('/editor-perf'))!;
	await frame.waitForFunction((n) => document.querySelectorAll('.perf-card').length === n, SECTIONS * 3, { timeout: 30_000 });
	await page.waitForTimeout(500);
	if (cpu > 1) {
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
	}
	return { page, frame, errors };
}

/**
 * Post one editor message from inside the frame (same origin as a trusted `localhost` editor) and
 * wait until `done` holds: the component counters for that edit and the time it took.
 */
async function edit(frame: Frame, message: unknown, done: string) {
	return frame.evaluate(
		async ({ message, done }) => {
			const g = globalThis as unknown as { __renders: number; __mounts: number };
			g.__renders = 0;
			g.__mounts = 0;
			const check = new Function(`return (${done})`) as () => boolean;
			const start = performance.now();
			window.postMessage(message, '*');
			for (;;) {
				await new Promise((r) => requestAnimationFrame(r));
				if (check()) break;
				if (performance.now() - start > 20_000) throw new Error('edit never landed: ' + done);
			}
			const ms = performance.now() - start;
			// let anything still queued settle, then read the counters
			await new Promise((r) => setTimeout(r, 100));
			return { ms: Math.round(ms), renders: g.__renders, mounts: g.__mounts };
		},
		{ message, done }
	);
}

const update = (content: Content) => ({ type: 'builder.contentUpdate', data: { key: 'page', data: content } });
const text_of = (id: string, text: string) => `document.querySelector('[builder-id="${id}"]')?.textContent?.includes(${JSON.stringify(text)})`;

/** One run of the edits; returns what each cost. */
async function run(port: number, cpu: number) {
	const { page, frame, errors } = await open(port, cpu);
	const base = perf_content(SECTIONS);
	const results: Record<string, { ms: number; renders: number; mounts: number }> = {};
	try {
		// 1. edit one Text deep in the page
		let next = clone(base);
		(next.data.blocks[50].children[1].component!.options as Record<string, unknown>).text = '<p>edited text</p>';
		results.text = await edit(frame, update(next), text_of('builder-t50', 'edited text'));

		// 2. edit one Card's title
		next = clone(next);
		(next.data.blocks[50].children[0].component!.options as Record<string, unknown>).title = 'edited card';
		results.card = await edit(frame, update(next), `!!document.querySelector('[data-card="edited card"]')`);

		// 3. the same content again (the editor re-sends on focus, selection, …)
		results.same = await edit(frame, update(clone(next)), `true`);

		// 4. a new section at the top (3 new Cards)
		next = clone(next);
		const fresh = clone(perf_content(1)).data.blocks[0] as Record<string, any>;
		const rename = (o: any): any => (Array.isArray(o) ? o.map(rename) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'id' ? `${v}-new` : rename(v)])) : o);
		next.data.blocks.unshift(rename(fresh));
		results.insert = await edit(frame, update(next), `!!document.querySelector('[builder-id="builder-s0-new"]')`);

		// 5. a burst: 20 keystrokes in one Text, as fast as the editor sends them
		const burst = frame.evaluate(
			async ({ base, sections }) => {
				const g = globalThis as unknown as { __renders: number; __mounts: number };
				g.__renders = 0;
				g.__mounts = 0;
				const start = performance.now();
				let content = base;
				for (let i = 1; i <= 20; i++) {
					content = JSON.parse(JSON.stringify(content));
					content.data.blocks[sections].children[1].component.options.text = `<p>typing ${'x'.repeat(i)}</p>`;
					window.postMessage({ type: 'builder.contentUpdate', data: { key: 'page', data: content } }, '*');
				}
				const want = `typing ${'x'.repeat(20)}`;
				for (;;) {
					await new Promise((r) => requestAnimationFrame(r));
					if (document.querySelector(`[builder-id="builder-t${sections - 1}"]`)?.textContent?.includes(want)) break;
					if (performance.now() - start > 20_000) throw new Error('burst never landed');
				}
				const ms = performance.now() - start;
				await new Promise((r) => setTimeout(r, 100));
				return { ms: Math.round(ms), renders: g.__renders, mounts: g.__mounts };
			},
			{ base: next, sections: SECTIONS }
		);
		results.burst = await burst;

		// 6. editor state reset (no block reads it)
		results.state = await edit(frame, { type: 'builder.resetState', data: { model: 'page', state: { foo: 1 } } }, `true`);
		return { results, errors };
	} finally {
		await page.close();
	}
}

describe.skipIf(!built)('one editor edit costs what changed', () => {
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

	for (const cpu of [1, 6]) {
		it(`${SECTIONS * 3} custom components, CPU ${cpu}×`, async () => {
			const official = await run(SDKS.official, cpu).catch((e) => ({ results: { failed: String(e) }, errors: [] }));
			const ours = await run(SDKS.ours, cpu);
			console.log(`CPU ${cpu}× — official:`, JSON.stringify(official.results), '\n        ours:', JSON.stringify(ours.results));
			expect(ours.errors).toEqual([]);
			const r = ours.results;
			// Nothing a Text edit touches is a custom component: none gets new props, none remounts.
			expect(r.text).toMatchObject({ renders: 0, mounts: 0 });
			// The edited Card, and only it.
			expect(r.card).toMatchObject({ renders: 1, mounts: 0 });
			expect(r.same).toMatchObject({ renders: 0, mounts: 0 });
			// The new section's 3 Cards mount; no other Card is touched.
			expect(r.insert).toMatchObject({ renders: 3, mounts: 3 });
			// 20 messages, coalesced: no Card touched at all, and well under a frame budget per keystroke.
			expect(r.burst).toMatchObject({ renders: 0, mounts: 0 });
			expect(r.state).toMatchObject({ renders: 0, mounts: 0 });
			// Wall-clock budget, generous for CI noise: an edit lands within a few frames even at 6×.
			for (const key of ['text', 'card', 'insert'] as const) expect(r[key].ms, key).toBeLessThan(cpu > 1 ? 500 : 150);
		}, 180_000);
	}
});
