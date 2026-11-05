// A/B tests in the browser, the official build against ours (and ours in Svelte's async mode): the
// variant a first visit is assigned (Math.random pinned, so both SDKs draw the same number) — the
// cookie, the variant visible before hydration (the inline script) and after, the impression's
// variationId — the same again on reload; a cookie already set; canTrack: false; nested symbol
// variants (which the official SDK gets wrong: recorded, not failed); an interactive variant.
// Pages: the official specs (/ab-test, /symbol-ab-test, /ab-test-interactive) and
// e2e/app/src/routes/client-ab (the same contents with canTrack from the URL).
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { BrowserContext, Page } from 'playwright';
import { differential, dom, fresh, hydrated, offline, pair_built, serve, until, type Captured, type Sdk, type Servers } from './client-harness.js';

let servers: Servers;
const get = () => servers;

const PAGE = { id: '691abdd7105c4cf7b9609995fc1fb56c', v1: '661775df8c2c41d6afc0aa1b5fd1dd61', v2: 'd7b7153da32c4d219b9b5c63ec129c94' };
const TEXT: Record<string, string> = { [PAGE.id]: 'This is the default variation!', [PAGE.v1]: 'This is variation 1', [PAGE.v2]: 'text only in variation 2' };
const SYMBOL = { id: 'd5580c8ba90443638ed240723abf67f0', v1: 'f7c6d013fa844a75aefe0f629723fb3b', v2: '7f877fde83a24edb9750738b7a4eb5bc' };
const SYMBOL_TEXT: Record<string, string> = { [SYMBOL.id]: 'symbol default variation', [SYMBOL.v1]: 'symbol variation 1', [SYMBOL.v2]: 'symbol: variation 2' };

/** The content wrappers a visitor sees: [model, the variant its text says, …]. */
const shown = (page: Page) =>
	page.evaluate(
		([texts]) =>
			[...document.querySelectorAll<HTMLElement>('[builder-content-id]')]
				.filter((el) => el.checkVisibility())
				.map((el) => {
					const t = el.innerText;
					const variant = Object.entries(texts).find(([, s]) => t.includes(s))?.[0] ?? null;
					return [el.getAttribute('builder-model'), variant];
				}),
		[{ ...TEXT, ...SYMBOL_TEXT }]
	);
const cookie = async (context: BrowserContext, id: string) => (await context.cookies()).find((c) => c.name === `builder.tests.${id}`)?.value ?? null;
const impressions = (requests: Captured[]) =>
	requests
		.filter((r) => r.url.endsWith('/api/v1/track'))
		.flatMap((r) => (r.body as { events: { type: string; data: { contentId?: string; variationId?: string } }[] }).events)
		.filter((e) => e.type === 'impression')
		.map((e) => [e.data.contentId, e.data.variationId ?? null]);

/** A context with Math.random pinned and (optionally) a test cookie already set. */
async function visitor({ random, cookies = {} }: { random?: number; cookies?: Record<string, string> }) {
	const { context, page, problems } = await fresh(servers);
	const requests = await offline(context);
	if (random !== undefined) await context.addInitScript((r) => (Math.random = () => r), random);
	const set = Object.entries(cookies).map(([id, value]) => ({ name: `builder.tests.${id}`, value, domain: 'localhost', path: '/' }));
	if (set.length) await context.addCookies(set);
	return { context, page, problems, requests };
}

describe.skipIf(!pair_built)('A/B tests behave the same in the browser', () => {
	beforeAll(async () => {
		servers = await serve(4520);
	});
	afterAll(async () => {
		await servers?.close();
	});

	// official bug: when a variation (not the default) wins, the official page is BLANK after
	// hydration — the default content's wrapper, hidden by the inline script before paint, is the one
	// the official SDK hydrates into the winner, and its `hidden` attribute is never removed. Ours
	// shows the winner. Recorded (official shows nothing), everything else compared.
	const BLANK_BUG = 'a winning variation is left `hidden` after hydration: the page is blank';
	const visible_after = (sdk: Sdk, winner: string, shown_now: unknown) => {
		if (sdk === 'official' && winner !== PAGE.id) expect(shown_now).toEqual([]); // (the bug, recorded)
		else expect(shown_now).toEqual([['page', winner]]);
	};
	type Run = Record<string, Record<string, unknown>>;
	const without_shown = (run: Run) => Object.fromEntries(Object.entries(run).map(([k, v]) => [k, k === 'before' ? v : { ...v, shown: '(masked)', tree: '(masked)' }]));
	const opts_for = (winner: string) =>
		winner === PAGE.id ? {} : { official_known: BLANK_BUG, compare: (ours: Run, official: Run) => expect(without_shown(ours)).toEqual(without_shown(official)) };

	// Math.random 0.1 → the first variation listed ("Variation 22"), 0.5 → "Variation 1", 0.9 → the
	// default (testRatio 1/3 each)
	for (const [random, expected] of [
		[0.1, PAGE.v2],
		[0.5, PAGE.v1],
		[0.9, PAGE.id]
	] as const) {
		differential(
			get,
			`first visit (Math.random ${random}): the cookie, the variant before and after hydration, on reload`,
			async (sdk) => {
				// before hydration: the server's HTML and its inline script only (the app's JS never loads)
				const ssr = await visitor({ random });
				await ssr.context.route(/\/_app\/immutable\//, (r) => r.abort());
				await ssr.page.goto(servers.origin(sdk) + '/ab-test');
				await ssr.page.waitForLoadState('load');
				const before = { cookie: await cookie(ssr.context, PAGE.id), shown: await shown(ssr.page) };
				await ssr.context.close();
				expect(before).toEqual({ cookie: expected, shown: [['page', expected]] });

				const { context, page, problems, requests } = await visitor({ random });
				await page.goto(servers.origin(sdk) + '/ab-test');
				await hydrated(page);
				await until(() => impressions(requests).length > 0, 10_000, 'the impression');
				await page.waitForTimeout(300); // (a second impression would be a bug)
				const after = { cookie: await cookie(context, PAGE.id), shown: await shown(page), impressions: impressions(requests), tree: await dom(page) };
				expect(after.cookie).toBe(expected);
				visible_after(sdk, expected, after.shown);
				expect(after.impressions).toEqual([[PAGE.id, expected === PAGE.id ? null : expected]]);
				// reload: the cookie decides (a different draw changes nothing)
				await context.addInitScript(() => (Math.random = () => 0.99));
				await page.reload();
				await hydrated(page);
				await until(() => impressions(requests).length > 1, 10_000, 'the second impression');
				await page.waitForTimeout(300);
				const reload = { cookie: await cookie(context, PAGE.id), shown: await shown(page), impressions: impressions(requests), tree: '' };
				expect(reload.cookie).toBe(expected);
				visible_after(sdk, expected, reload.shown);
				expect(reload.impressions).toHaveLength(2);
				expect(problems.errors).toEqual([]);
				expect(problems.warnings).toEqual([]);
				await context.close();
				return { before, after, reload } as Run;
			},
			opts_for(expected)
		);
	}

	// regression: with a variation's cookie ours sent its impression twice (the hidden variation's
	// view, then the view re-keyed to the winner after mount)
	for (const [name, value] of [
		['the default', PAGE.id],
		['variation 1', PAGE.v1],
		['variation 2', PAGE.v2]
	] as const) {
		differential(
			get,
			`a cookie for ${name}: that variant only, after hydration; one impression`,
			async (sdk) => {
				const { context, page, problems, requests } = await visitor({ cookies: { [PAGE.id]: value } });
				await page.goto(servers.origin(sdk) + '/ab-test');
				await hydrated(page);
				await until(() => impressions(requests).length > 0, 10_000, 'the impression');
				await page.waitForTimeout(300);
				const result = { shown: await shown(page), impressions: impressions(requests), cookie: await cookie(context, PAGE.id), tree: await dom(page) };
				visible_after(sdk, value, result.shown);
				expect(result.impressions).toEqual([[PAGE.id, value === PAGE.id ? null : value]]);
				expect(problems.errors).toEqual([]);
				expect(problems.warnings).toEqual([]);
				await context.close();
				return { result } as Run;
			},
			opts_for(value)
		);
	}

	differential(get, 'canTrack: false: the default content, no cookie read or written, no impression', async (sdk) => {
		const results: unknown[] = [];
		for (const cookies of [{}, { [PAGE.id]: PAGE.v1 }]) {
			const { context, page, problems, requests } = await visitor({ random: 0.1, cookies });
			await page.goto(servers.origin(sdk) + '/client-ab?p=/ab-test&canTrack=0');
			await hydrated(page);
			await page.waitForTimeout(300);
			const result = { shown: await shown(page), cookie: await cookie(context, PAGE.id), impressions: impressions(requests), tree: await dom(page) };
			expect(result.shown).toEqual([['page', PAGE.id]]);
			expect(result.cookie).toBe(Object.keys(cookies).length ? PAGE.v1 : null);
			expect(result.impressions).toEqual([]);
			expect(problems.errors).toEqual([]);
			results.push(result);
			await context.close();
		}
		return results;
	});

	// Nested symbol variants: the official SDK's server render of a symbol's A/B variants is wrong (the
	// 10 tests the official e2e suite fails and ours passes, README). Recorded for official.
	for (const [name, value] of [
		['the default', SYMBOL.id],
		['variation 1', SYMBOL.v1],
		['variation 2', SYMBOL.v2]
	] as const) {
		differential(
			get,
			`nested symbol, a cookie for ${name}: that symbol variant only, before and after hydration`,
			async (sdk) => {
				const ssr = await visitor({ cookies: { [SYMBOL.id]: value } });
				await ssr.context.route(/\/_app\/immutable\//, (r) => r.abort());
				await ssr.page.goto(servers.origin(sdk) + '/symbol-ab-test');
				await ssr.page.waitForLoadState('load');
				const before = (await shown(ssr.page)).filter(([model]) => model === 'symbol');
				await ssr.context.close();

				const { context, page, problems } = await visitor({ cookies: { [SYMBOL.id]: value } });
				await page.goto(servers.origin(sdk) + '/symbol-ab-test');
				await hydrated(page);
				const after = (await shown(page)).filter(([model]) => model === 'symbol');
				expect(before).toEqual([['symbol', value]]);
				expect(after).toEqual([['symbol', value]]);
				expect(problems.errors).toEqual([]);
				const tree = await dom(page);
				await context.close();
				return { before, after, tree };
			},
			value === SYMBOL.id ? {} : { official_known: "a nested symbol's variant is not the one its cookie names (the official SSR renders the default)" }
		);
	}

	differential(get, 'nested symbol, first visit (Math.random 0.1): the symbol variant assigned, and kept', async (sdk) => {
		const { context, page, problems } = await visitor({ random: 0.1 });
		await page.goto(servers.origin(sdk) + '/symbol-ab-test');
		await hydrated(page);
		const first = { cookie: await cookie(context, SYMBOL.id), shown: (await shown(page)).filter(([m]) => m === 'symbol') };
		expect(first.cookie).not.toBe(null);
		expect(first.shown).toEqual([['symbol', first.cookie]]);
		await page.reload();
		await hydrated(page);
		const again = { cookie: await cookie(context, SYMBOL.id), shown: (await shown(page)).filter(([m]) => m === 'symbol') };
		expect(again).toEqual(first);
		expect(problems.errors).toEqual([]);
		await context.close();
		return first;
	}, { official_known: "a nested symbol's assigned variant is not the one shown" });

	differential(get, '/ab-test-interactive: the variant hydrates; its link navigates client-side', async (sdk) => {
		const { context, page, problems } = await visitor({ cookies: { [PAGE.id]: PAGE.v1 } });
		await page.goto(servers.origin(sdk) + '/ab-test-interactive');
		await hydrated(page);
		const variant = await shown(page);
		await page.locator('a').locator('visible=true').first().click({ timeout: 5000 });
		await until(() => page.getByText('Stack at tablet').first().isVisible(), 10_000, 'the /columns page');
		expect(new URL(page.url()).pathname).toBe('/columns');
		expect(problems.errors).toEqual([]);
		expect(problems.warnings).toEqual([]);
		await context.close();
		return variant;
	}, { official_known: BLANK_BUG + ' (no visible link to click)', timeout: 30_000 });
});

