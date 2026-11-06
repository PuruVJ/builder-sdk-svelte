// Content state in the browser, the official build against ours (and ours in Svelte's async mode):
// block actions (click / input) updating state; bindings, `{{state}}` text and style bindings
// re-rendering; show / hide toggling; repeated lists growing, shrinking, reordering (and mutated in
// place); jsCode; content.data.httpRequests (the same requests, the results landing in state); a
// large reactive state. The same DOM after every step.
// Pages: e2e/app/src/routes/client-state and the official e2e specs (/reactive-state, /js-code, …).
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { BrowserContext, Page } from 'playwright';
import { capture, differential, dom, open_page, pair_built, serve, until, type Captured, type Problems, type Sdk, type Servers } from './client-harness.js';

let servers: Servers;
const get = () => servers;
const open = (sdk: Sdk, route: string, before?: (context: BrowserContext, page: Page) => Promise<void>) => open_page(servers, sdk, route, { before });

/** A page's errors, less the evaluation warnings both SDKs log for a binding that reads state not
 * loaded yet (an httpRequests result: `state.article.entries[0]` before the response). */
const unexpected = (problems: Problems) => problems.errors.filter((e) => !e.includes('Failed code evaluation'));

/** The page's visible text, one line. */
const text = (page: Page) => page.evaluate(() => (document.querySelector('main') as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
const has = (page: Page, s: string) => until(async () => (await text(page)).includes(s), 5000, JSON.stringify(s));
const lacks = (page: Page, s: string) => until(async () => !(await text(page)).includes(s), 5000, 'no ' + JSON.stringify(s));
const click = (page: Page, label: string) => page.getByText(label, { exact: true }).click();

describe.skipIf(!pair_built)('content state behaves the same in the browser', () => {
	beforeAll(async () => {
		servers = await serve(4505);
	});
	afterAll(async () => {
		await servers?.close();
	});

	differential(get, 'actions update state; bindings, {{state}} text and style bindings follow', async (sdk) => {
		const { context, page, problems } = await open(sdk, '/client-state?c=state');
		const steps: unknown[] = [];
		const snap = async () => steps.push(await dom(page), await page.locator('[builder-id="builder-styled"]').evaluate((e) => getComputedStyle(e).color));
		await has(page, 'count: 0');
		await has(page, 'name is nobody and count is 0');
		await snap();
		for (const n of [1, 2, 3]) {
			await click(page, 'Increment');
			await has(page, `count: ${n}`);
			await has(page, `name is nobody and count is ${n}`);
			await snap();
		}
		expect(await page.locator('[builder-id="builder-styled"]').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(255, 0, 0)');
		await click(page, 'Decrement');
		await has(page, 'count: 2');
		await snap();
		// an input action, every keystroke
		await page.locator('[data-name-input]').pressSequentially('Ann', { delay: 20 });
		await has(page, 'hello Ann');
		await has(page, 'name is Ann and count is 2');
		await snap();
		// a nested path
		await click(page, 'Deep +10');
		await has(page, 'deep: 11');
		await click(page, 'Deep +10');
		await has(page, 'deep: 21');
		await snap();
		// jsCode ran once, before the first render, on the initial state
		expect(await text(page)).toContain('jsCode ran: 0 / 20');
		expect(unexpected(problems)).toEqual([]);
		await context.close();
		return steps;
	});

	differential(get, 'show / hide bindings toggle with state', async (sdk) => {
		const { context, page, problems } = await open(sdk, '/client-state?c=state');
		const steps: unknown[] = [];
		for (let n = 0; n < 4; n++) {
			if (n) await click(page, 'Increment');
			await has(page, `count: ${n}`);
			const even = n % 2 === 0;
			await (even ? has(page, 'even count') : has(page, 'odd count'));
			await (even ? lacks(page, 'odd count') : lacks(page, 'even count'));
			steps.push(
				await page.evaluate(() => ['even', 'odd'].map((id) => !!document.querySelector(`[builder-id="builder-${id}"]`))),
				await dom(page)
			);
		}
		expect(unexpected(problems)).toEqual([]);
		await context.close();
		return steps;
	});

	differential(get, 'repeated lists grow, shrink, reorder, empty — and follow in-place mutation', async (sdk) => {
		const { context, page, problems } = await open(sdk, '/client-state?c=state');
		const rows = () => page.locator('[data-row]').evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.trim()));
		const tpl = () => page.locator('[builder-id="builder-tpl-row"]').evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.trim()));
		const steps: unknown[] = [];
		const step = async (expected: string[]) => {
			await until(async () => JSON.stringify(await rows()) === JSON.stringify(expected), 5000, 'rows ' + JSON.stringify(expected));
			await has(page, `items: ${expected.length}`);
			steps.push(await rows(), await tpl(), await dom(page));
		};
		await step(['row 0: a', 'row 1: b']);
		expect(await tpl()).toEqual(['tpl a of 2', 'tpl b of 2']);
		await click(page, 'Add item');
		await step(['row 0: a', 'row 1: b', 'row 2: n2']);
		await click(page, 'Push item'); // `state.items.push(…)`: a mutation, not a new array
		await step(['row 0: a', 'row 1: b', 'row 2: n2', 'row 3: p3']);
		// a new array at the same length: every index shows its new item (regression: ours kept the
		// mounted items — a repeated block held the scope of its first item)
		await click(page, 'Reverse items');
		await step(['row 0: p3', 'row 1: n2', 'row 2: b', 'row 3: a']);
		await click(page, 'Pop item');
		await step(['row 0: p3', 'row 1: n2', 'row 2: b']);
		await click(page, 'Clear items');
		await step([]);
		await click(page, 'Add item');
		await step(['row 0: n0']);
		expect(unexpected(problems)).toEqual([]);
		await context.close();
		return steps;
	});

	// official bug (the same as /state-binding below): a repeated block's click writing root state does
	// not re-render a binding outside the repeat.
	differential(
		get,
		"a repeated block's click action sees its own item (after a reorder too) and writes root state",
		async (sdk) => {
			const { context, page, problems } = await open(sdk, '/client-state?c=state');
			await page.getByText('row 1: b', { exact: true }).click();
			await has(page, 'picked: b');
			await click(page, 'Reverse items');
			await until(() => page.getByText('row 1: a', { exact: true }).isVisible(), 5000, 'reversed');
			await page.getByText('row 1: a', { exact: true }).click();
			await has(page, 'picked: a');
			const tree = await dom(page);
			expect(unexpected(problems)).toEqual([]);
			await context.close();
			return tree;
		},
		{ official_known: 'a click on a repeated item writing root state does not re-render the binding that reads it' }
	);

	differential(get, 'jsCode (/js-code): state set by the content code drives a binding a click toggles', async (sdk) => {
		const { context, page, problems } = await open(sdk, '/js-code');
		const steps: unknown[] = [];
		await has(page, 'jsCode text');
		steps.push(await dom(page));
		await page.getByRole('button').click();
		await lacks(page, 'jsCode text');
		steps.push(await dom(page));
		await page.getByRole('button').click();
		await has(page, 'jsCode text');
		steps.push(await dom(page));
		expect(unexpected(problems)).toEqual([]);
		await context.close();
		return steps;
	});

	differential(get, '/reactive-state: a click increments a bound value', async (sdk) => {
		const { context, page, problems } = await open(sdk, '/reactive-state');
		const steps: unknown[] = [await dom(page)];
		for (const n of [1, 2]) {
			await click(page, 'Increment Number');
			await until(() => page.getByText(String(n), { exact: true }).isVisible(), 5000, String(n));
			steps.push(await dom(page));
		}
		expect(unexpected(problems)).toEqual([]);
		await context.close();
		return steps;
	});

	differential(get, '/show-hide-if and /show-hide-if-repeats: reactive conditions (click, hover)', async (sdk) => {
		const { context, page, problems } = await open(sdk, '/show-hide-if');
		const steps: unknown[] = [];
		await has(page, 'even clicks');
		await lacks(page, 'odd clicks');
		expect(await text(page)).not.toContain('this never appears');
		steps.push(await dom(page));
		await page.getByRole('button').click();
		await has(page, 'odd clicks');
		await lacks(page, 'even clicks');
		steps.push(await dom(page));
		await page.goto(servers.origin(sdk) + '/show-hide-if-repeats');
		await page.waitForLoadState('load');
		await page.waitForFunction(() => history.state?.['sveltekit:history'] != null);
		await page.waitForTimeout(100);
		steps.push(await dom(page));
		for (const [b, word] of [
			['button2', 'two'],
			['button3', 'three']
		]) {
			await page.hover(`text=${b}`);
			await has(page, word);
			steps.push(await dom(page));
		}
		expect(unexpected(problems)).toEqual([]);
		await context.close();
		return steps;
	});

	differential(get, '/element-events: click actions on a button, a box and a text', async (sdk) => {
		const { context, page, problems } = await open(sdk, '/element-events');
		const logged: string[] = [];
		page.on('console', (m) => m.text().startsWith('clicked') && logged.push(m.text()));
		for (const label of ['Click me!', 'clickable BOX', 'clickable text']) {
			const before = logged.length;
			await page.getByText(label).click();
			await until(() => logged.length > before, 5000, 'a click log');
		}
		expect(logged).toEqual(['clicked button', 'clicked box', 'clicked text']);
		expect(unexpected(problems)).toEqual([]);
		await context.close();
		return logged;
	});

	// official bug (the official e2e suite skips it for sveltekit): writing state from a repeated
	// block's click does not update a binding outside the repeat.
	differential(
		get,
		'/state-binding: jsCode-initialised state; a repeated item writes state a binding reads',
		async (sdk) => {
			const { context, page, problems } = await open(sdk, '/state-binding');
			await has(page, 'initial Name');
			const steps: unknown[] = [await dom(page)];
			await page.getByText('first').first().click();
			await has(page, 'repeated set');
			steps.push(await dom(page));
			expect(unexpected(problems)).toEqual([]);
			await context.close();
			return steps;
		},
		{ official_known: 'a click on a repeated item writing state does not re-render the binding (skipped for sveltekit in the official suite)' }
	);

	// ── content.data.httpRequests ──────────────────────────────────────────────────────────────
	differential(get, 'httpRequests: the same requests (templated URLs, POST with headers + body), results land in state', async (sdk) => {
		const api: Captured[] = [];
		const { context, page, problems } = await open(sdk, '/client-state?c=http', async (context) => {
			await context.route('https://api.test/**', (route) => {
				const req = capture(route.request());
				api.push(req);
				const url = new URL(req.url);
				if (url.pathname === '/broken') return route.fulfill({ status: 500, contentType: 'text/plain', body: 'not json', headers: { 'access-control-allow-origin': '*' } });
				const json = url.pathname === '/items' ? { title: 'items for ' + url.searchParams.get('n'), list: ['x', 'y'] } : { echo: req.body && (req.body as { hello: string }).hello };
				return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json), headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
			});
		});
		await has(page, 'got: items for 3');
		await has(page, 'posted: world');
		await has(page, 'entry y');
		await page.waitForTimeout(200);
		const requests = api
			.filter((r) => r.method !== 'OPTIONS')
			.map((r) => ({
				url: r.url,
				method: r.method,
				headers: Object.fromEntries(Object.entries(r.headers).filter(([k]) => k === 'content-type' || k.startsWith('x-'))),
				body: r.body
			}))
			.sort((a, b) => a.url.localeCompare(b.url));
		expect(requests.map((r) => r.method + ' ' + r.url)).toEqual([
			'GET https://api.test/broken',
			'GET https://api.test/items?n=3&q=6',
			'POST https://api.test/post?n=3'
		]);
		expect(requests[2]).toMatchObject({ headers: { 'content-type': 'application/json', 'x-test': 'yes' }, body: { hello: 'world' } });
		// a failing request is logged, never thrown
		expect(unexpected(problems).filter((e) => !/error fetching dynamic data|status of 500/.test(e))).toEqual([]);
		const result = { requests, tree: await dom(page), logged: problems.errors.filter((e) => e.includes('error fetching dynamic data')).length };
		await context.close();
		return result;
	});

	differential(get, 'httpRequests (/http-requests): the proxy API is called once, its result rendered', async (sdk) => {
		let calls = 0;
		const { context, page, problems } = await open(sdk, '/http-requests', async (context) => {
			await context.route(/cdn\.builder\.io\/api\/v1\/proxy-api/, (route) => {
				calls++;
				return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [{ seo_title: 'foo' }] }), headers: { 'access-control-allow-origin': '*' } });
			});
		});
		await until(() => page.getByText('foo').isVisible(), 5000, 'foo');
		await page.waitForTimeout(300);
		expect(calls).toBe(1);
		expect(unexpected(problems)).toEqual([]);
		const tree = await dom(page);
		await context.close();
		return { calls, tree };
	});

	for (const route of ['/http-requests-get-api', '/http-requests-post-api']) {
		differential(get, `httpRequests (${route}): the same request, the response rendered`, async (sdk) => {
			const seen: Captured[] = [];
			const { context, page, problems } = await open(sdk, route, async (context) => {
				await context.route(/cdn\.builder\.io\/api\/v(2|3)\//, (r) => {
					seen.push(capture(r.request()));
					return r.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({ entries: [{ seo_title: 'from the api' }], data: { title: 'from the api' }, results: [{ name: 'from the api' }] }),
						headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
					});
				});
			});
			await until(() => seen.some((r) => r.method !== 'OPTIONS'), 5000, 'the request');
			await page.waitForTimeout(300);
			const requests = seen
				.filter((r) => r.method !== 'OPTIONS')
				.map((r) => ({ url: r.url, method: r.method, body: r.body, headers: Object.fromEntries(Object.entries(r.headers).filter(([k]) => k === 'content-type' || k.startsWith('x-'))) }));
			expect(unexpected(problems)).toEqual([]);
			const tree = await dom(page);
			await context.close();
			return { requests, tree };
		});
	}

	differential(get, '/large-reactive-state: 1000 blocks, a bound counter stays reactive', async (sdk) => {
		const { context, page, problems } = await open(sdk, '/large-reactive-state');
		await until(() => page.getByText('Dummy text block 1000').isVisible(), 5000, 'block 1000');
		const steps: unknown[] = [];
		for (let i = 1; i <= 5; i++) {
			await click(page, 'Increment Number');
			await until(() => page.getByText(String(i), { exact: true }).isVisible(), 5000, String(i));
		}
		steps.push(await dom(page));
		expect(unexpected(problems)).toEqual([]);
		await context.close();
		return steps;
	});
});
