// Preview links in the browser, the official build against ours (and ours in Svelte's async mode):
// `?builder.preview=page&builder.overrides.page=<id>&apiKey=…` fetches the draft (the same request to
// the content API) and the draft replaces the published content; a BUILDER_STUDIO preview fetches
// every content, a symbol by its id; a preview link for another model, another apiKey or another
// entry fetches nothing and changes nothing.
// Page: e2e/app/src/routes/client-preview (a `page` with a symbol, and a `header`).
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { Page } from 'playwright';
import { DRAFTS } from '../e2e/app/src/routes/client-preview/contents.js';
import { differential, fresh, hydrated, offline, pair_built, serve, until, type Captured, type Servers } from './client-harness.js';

let servers: Servers;
const get = () => servers;
const CONTENT_API_RE = /\/api\/v3\/content\/([^/?]+)/;

/** A content API request, comparable: its path, its params sorted. */
const request_of = (r: Captured) => {
	const url = new URL(r.url);
	const params = [...url.searchParams].map(([k, v]) => `${k}=${v}`).sort();
	return `${r.method} ${url.origin}${url.pathname}?${params.join('&')}`.replace(/localhost:\d+/g, 'localhost:PORT');
};
const lines = (page: Page) =>
	page.evaluate(() => ['[data-header]', '[data-page]', '[data-sym]'].map((s) => document.querySelector(s)?.textContent?.trim() ?? null));

async function preview(sdk: Parameters<Servers['origin']>[0], search: string) {
	const { context, page, problems } = await fresh(servers);
	const requests = await offline(context, (req) => {
		const model = CONTENT_API_RE.exec(req.url)?.[1];
		return model ? { json: { results: DRAFTS[model] ? [DRAFTS[model]] : [] } } : undefined;
	});
	await page.goto(servers.origin(sdk) + '/client-preview' + search);
	await hydrated(page);
	const api = () => requests.filter((r) => CONTENT_API_RE.test(r.url) && r.method === 'GET');
	return { context, page, problems, api };
}

describe.skipIf(!pair_built)('preview links behave the same in the browser', () => {
	beforeAll(async () => {
		servers = await serve(4530);
	});
	afterAll(async () => {
		await servers?.close();
	});

	differential(get, 'a preview link of this page: the same draft request, the draft replaces the page', async (sdk) => {
		const { context, page, problems, api } = await preview(sdk, '?builder.preview=page&builder.overrides.page=preview-page&apiKey=abcd');
		await until(async () => (await lines(page))[1] === 'draft page', 5000, 'the draft page');
		await page.waitForTimeout(300);
		const result = { requests: api().map(request_of), lines: await lines(page) };
		expect(result.requests).toHaveLength(1);
		expect(result.requests[0]).toMatch(/^GET https:\/\/cdn\.builder\.io\/api\/v3\/content\/page\?/);
		// the header (another model) and the symbol keep their published content
		expect(result.lines).toEqual(['published header', 'draft page', 'published symbol']);
		expect(problems.errors).toEqual([]);
		await context.close();
		return result;
	});

	differential(get, 'BUILDER_STUDIO: every content fetches its draft, the symbol by its id', async (sdk) => {
		const { context, page, problems, api } = await preview(sdk, '?builder.preview=BUILDER_STUDIO&apiKey=abcd');
		await until(async () => JSON.stringify(await lines(page)) === JSON.stringify(['draft header', 'draft page', 'draft symbol']), 5000, 'every draft');
		await page.waitForTimeout(300);
		const requests = api().map(request_of).sort();
		expect(requests.map((r) => r.split('?')[0])).toEqual(['header', 'page', 'symbol'].map((m) => `GET https://cdn.builder.io/api/v3/content/${m}`));
		expect(requests[2]).toContain('query.id="builder-sym"'); // (the symbol BLOCK's id: official context.symbolId)
		expect(problems.errors).toEqual([]);
		const shown = await lines(page);
		await context.close();
		return { requests, lines: shown };
	});

	for (const [what, search] of [
		['another model', '?builder.preview=footer&builder.overrides.footer=preview-page&apiKey=abcd'],
		['another apiKey', '?builder.preview=page&builder.overrides.page=preview-page&apiKey=someone-else'],
		['another entry', '?builder.preview=page&builder.overrides.page=another-entry&apiKey=abcd'],
		['no apiKey', '?builder.preview=page&builder.overrides.page=preview-page']
	]) {
		differential(get, `a preview link for ${what}: no fetch, the published content stays`, async (sdk) => {
			const { context, page, problems, api } = await preview(sdk, search);
			await page.waitForTimeout(700);
			expect(api()).toEqual([]);
			expect(await lines(page)).toEqual(['published header', 'published page', 'published symbol']);
			expect(problems.errors).toEqual([]);
			await context.close();
			return true;
		});
	}

	differential(get, 'a preview link of the header (builder.space for the key): only the header fetches', async (sdk) => {
		const { context, page, problems, api } = await preview(sdk, '?builder.preview=header&builder.overrides.header=preview-header&builder.space=abcd');
		await until(async () => (await lines(page))[0] === 'draft header', 5000, 'the draft header');
		await page.waitForTimeout(300);
		const result = { requests: api().map(request_of), lines: await lines(page) };
		expect(result.lines).toEqual(['draft header', 'published page', 'published symbol']);
		expect(problems.errors).toEqual([]);
		await context.close();
		return result;
	});
});
