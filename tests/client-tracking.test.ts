// Tracking in the browser, the official build against ours (and ours in Svelte's async mode): the
// impression and click POSTs to /api/v1/track (the same events, fields and headers), the session
// cookie and visitor id (created once, reused, the same cookie attributes, an existing pair adopted),
// canTrack: false sending nothing and storing nothing, no tracking inside the editor, and
// builder.trackConversion() from content code.
// Pages: the official e2e specs (/, /can-track-false, /symbol-tracking, /track-conversion).
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { BrowserContext, Page } from 'playwright';
import { differential, in_editor, open_page, pair_built, serve, until, type Captured, type Servers } from './client-harness.js';

let servers: Servers;
const get = () => servers;

const ID_RE = /^[a-f0-9]{32}$/;
const PORT_RE = /localhost:\d+/g;
const tracks = (requests: Captured[]) => requests.filter((r) => r.method === 'POST' && r.url.endsWith('/api/v1/track'));
type TrackEvent = { type: string; data: Record<string, any> };
const events = (requests: Captured[]) => tracks(requests).flatMap((r) => (r.body as { events: TrackEvent[] }).events);

/** An event with its random ids checked and masked, and the server port masked. */
function normal(e: TrackEvent) {
	const { sessionId, visitorId, ...data } = e.data;
	expect(sessionId).toMatch(ID_RE);
	expect(visitorId).toMatch(ID_RE);
	return JSON.parse(JSON.stringify({ type: e.type, data }).replace(PORT_RE, 'localhost:PORT'));
}
const headers = (r: Captured) => Object.fromEntries(Object.entries(r.headers).filter(([k]) => k === 'content-type' || k.startsWith('x-builder')));

/** Waits until `count()` has held still for `quiet` ms (every pending track POST is in). */
async function settle(count: () => number, quiet = 500) {
	let last = -1;
	let since = Date.now();
	for (;;) {
		const n = count();
		if (n !== last) {
			last = n;
			since = Date.now();
		} else if (Date.now() - since >= quiet) return n;
		await new Promise((r) => setTimeout(r, 25));
	}
}

async function cookies_of(context: BrowserContext) {
	return (await context.cookies()).filter((c) => c.name.startsWith('builder'));
}
const visitor = (page: Page) => page.evaluate(() => localStorage.getItem('builderVisitorId'));

describe.skipIf(!pair_built)('tracking behaves the same in the browser', () => {
	beforeAll(async () => {
		servers = await serve(4515);
	});
	afterAll(async () => {
		await servers?.close();
	});

	differential(get, 'impressions: one POST per content, the same fields and SDK headers', async (sdk) => {
		const { context, requests, problems } = await open_page(servers, sdk, '/');
		await until(() => tracks(requests).length > 0, 10_000, 'an impression');
		await settle(() => tracks(requests).length);
		const posts = tracks(requests);
		const all = events(requests).map(normal);
		expect(all.every((e) => e.type === 'impression')).toBe(true);
		expect(all[0].data).toMatchObject({ ownerId: 'abcd', userAttributes: { device: 'desktop', urlPath: '/', host: 'localhost:PORT' }, metadata: { url: 'http://localhost:PORT/' } });
		expect(headers(posts[0])).toMatchObject({ 'content-type': 'application/json', 'x-builder-sdk': 'svelte', 'x-builder-sdk-gen': '2' });
		expect(headers(posts[0])['x-builder-sdk-version']).toMatch(/^\d+\.\d+\.\d+/);
		// one session for the page: every event carries the same ids
		const ids = new Set(events(requests).map((e) => e.data.sessionId + e.data.visitorId));
		expect(ids.size).toBe(1);
		expect(problems.errors).toEqual([]);
		await context.close();
		return { events: all.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), headers: posts.map(headers) };
	});

	differential(get, 'clicks: a click POST with heatmap metadata; unique only for the first', async (sdk) => {
		const { context, page, requests, problems } = await open_page(servers, sdk, '/', { context_options: { viewport: { width: 1200, height: 800 } } });
		await until(() => tracks(requests).length > 0, 10_000, 'an impression');
		await settle(() => tracks(requests).length);
		const clicks = () => events(requests).filter((e) => e.type === 'click');
		const target = page.getByText('SDK Feature testing project').first();
		await target.click({ position: { x: 5, y: 5 } });
		await until(() => clicks().length === 1, 5000, 'a click POST');
		await target.click({ position: { x: 10, y: 8 } });
		await until(() => clicks().length >= 2, 5000, 'a second click POST');
		await settle(() => tracks(requests).length);
		const all = clicks().map(normal);
		expect(all[0].data.unique).toBe(true);
		expect(all[1].data.unique).toBe(false);
		const m = all[0].data.metadata;
		for (const v of [m.builderElementIndex, m.builderTargetOffset.x, m.builderTargetOffset.y, m.targetOffset.x, m.targetOffset.y]) expect(Number.isFinite(Number(v))).toBe(true);
		expect(all[0].data.targetBuilderElement).toMatch(/^builder-/);
		expect(problems.errors).toEqual([]);
		await context.close();
		return all;
	});

	differential(get, 'session cookie + visitor id: created once, reused on reload, the same cookie', async (sdk) => {
		const { context, page, requests } = await open_page(servers, sdk, '/');
		await until(() => tracks(requests).length > 0, 10_000, 'an impression');
		await settle(() => tracks(requests).length);
		const first = events(requests)[0].data;
		const cookies = await cookies_of(context);
		const session = cookies.find((c) => c.name === 'builderSessionId')!;
		expect(session.value).toBe(first.sessionId);
		expect(await visitor(page)).toBe(first.visitorId);
		const n = tracks(requests).length;
		await page.reload();
		await until(() => tracks(requests).length > n, 10_000, 'the impression after reload');
		await settle(() => tracks(requests).length);
		const again = events(requests).at(-1)!.data;
		expect([again.sessionId, again.visitorId]).toEqual([first.sessionId, first.visitorId]);
		await context.close();
		// (the cookie's attributes, the value masked)
		return cookies.map(({ value, expires, ...c }) => ({ ...c, value: ID_RE.test(value) ? 'ID' : value, session_cookie: expires === -1 }));
	});

	differential(get, 'an existing session cookie and visitor id are adopted, not replaced', async (sdk) => {
		const SESSION = 'a'.repeat(32);
		const VISITOR = 'b'.repeat(32);
		const { context, page, requests } = await open_page(servers, sdk, '/', {
			before: async (context) => {
				await context.addCookies([{ name: 'builderSessionId', value: SESSION, domain: 'localhost', path: '/' }]);
				await context.addInitScript((v) => localStorage.setItem('builderVisitorId', v), VISITOR);
			}
		});
		await until(() => tracks(requests).length > 0, 10_000, 'an impression');
		await settle(() => tracks(requests).length);
		const ids = events(requests).map((e) => [e.data.sessionId, e.data.visitorId]);
		expect(new Set(ids.map(String))).toEqual(new Set([`${SESSION},${VISITOR}`]));
		expect((await cookies_of(context)).map((c) => [c.name, c.value])).toEqual([['builderSessionId', SESSION]]);
		expect(await visitor(page)).toBe(VISITOR);
		await context.close();
		return ids.length;
	});

	for (const route of ['/can-track-false', '/symbol-tracking']) {
		differential(get, `canTrack: false (${route}): no POST, no cookie, no visitor id — clicks included`, async (sdk) => {
			const { context, page, requests, problems } = await open_page(servers, sdk, route);
			await page.waitForTimeout(500);
			await page.locator('[builder-id]').first().click();
			await page.waitForTimeout(500);
			expect(tracks(requests)).toEqual([]);
			expect(await cookies_of(context)).toEqual([]);
			expect(await visitor(page)).toBe(null);
			expect(problems.errors).toEqual([]);
			await context.close();
			return true;
		});
	}

	differential(get, 'inside the editor: no impression, no click POST', async (sdk) => {
		const editor = await in_editor(servers, sdk, '/');
		const requests: Captured[] = [];
		editor.context.on('request', (r) => r.url().includes('/api/v1/track') && requests.push({ url: r.url(), method: r.method(), headers: {}, body: null }));
		await editor.frame.waitForSelector('[builder-id]');
		await editor.page.waitForTimeout(500);
		await editor.frame.locator('[builder-id]').first().click();
		await editor.page.waitForTimeout(500);
		expect(requests).toEqual([]);
		await editor.context.close();
		return true;
	});

	differential(get, 'builder.trackConversion() from content code: conversion events with amount + properties', async (sdk) => {
		const { context, page, requests, problems } = await open_page(servers, sdk, '/track-conversion');
		// (this content has no id: no impression to wait for)
		await settle(() => tracks(requests).length);
		const impressions = events(requests).map(normal);
		const conversions = () => events(requests).filter((e) => e.type === 'conversion');
		await page.getByText('Track Conversion', { exact: true }).click();
		await until(() => conversions().length === 1, 5000, 'a conversion');
		await page.getByText('Track Conversion With Props', { exact: true }).click();
		await until(() => conversions().length === 2, 5000, 'a second conversion');
		await settle(() => tracks(requests).length);
		const all = conversions().map(normal);
		expect(all[0].data.metadata.amount).toBe(10);
		expect(all[1].data.metadata).toMatchObject({ amount: 25, customField: 'test-value' });
		expect(all[0].data.userAttributes.urlPath).toBe('/track-conversion');
		expect(problems.errors).toEqual([]);
		await context.close();
		return { impressions, conversions: all };
	});
});

