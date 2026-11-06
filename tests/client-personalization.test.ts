// Personalization containers in the browser, the official build against ours (and ours in Svelte's
// async mode): the variant a visitor's attributes pick (from the cookie before hydration and after;
// then live, as setClientUserAttributes changes them), the cookie it writes, and the
// builder.variantLoaded / builder.variantDisplayed events (displayed only once in view).
// Pages: e2e/app/src/routes/client-personalization and the official /variant-containers spec.
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { BrowserContext, Page } from 'playwright';
import { differential, dom, fresh, hydrated, offline, pair_built, serve, until, type Servers } from './client-harness.js';

let servers: Servers;
const get = () => servers;

/** The personalized lines a visitor sees. */
const seen = (page: Page) =>
	page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('main p')].filter((p) => p.checkVisibility() && p.textContent!.includes(': ')).map((p) => p.textContent!.trim())
	);
const events = (page: Page) => page.evaluate(() => (window as unknown as { __variant_events: unknown[] }).__variant_events);
const attrs_cookie = async (context: BrowserContext) => {
	const c = (await context.cookies()).find((c) => c.name === 'builder.userAttributes');
	return c ? JSON.parse(decodeURIComponent(c.value)) : null;
};

async function visitor(attrs?: Record<string, string>) {
	const { context, page, problems } = await fresh(servers, { viewport: { width: 1000, height: 700 } });
	await offline(context);
	if (attrs) await context.addCookies([{ name: 'builder.userAttributes', value: JSON.stringify(attrs), domain: 'localhost', path: '/' }]);
	return { context, page, problems };
}

describe.skipIf(!pair_built)('personalization behaves the same in the browser', () => {
	beforeAll(async () => {
		servers = await serve(4525);
	});
	afterAll(async () => {
		await servers?.close();
	});

	for (const device of ['tablet', 'mobile', 'desktop']) {
		differential(get, `the attributes cookie (device: ${device}) picks the variant, before and after hydration`, async (sdk) => {
			const ssr = await visitor({ device });
			await ssr.context.route(/\/_app\/immutable\//, (r) => r.abort());
			await ssr.page.goto(servers.origin(sdk) + '/client-personalization');
			await ssr.page.waitForLoadState('load');
			const before = await seen(ssr.page);
			await ssr.context.close();

			const { context, page, problems } = await visitor({ device });
			await page.goto(servers.origin(sdk) + '/client-personalization');
			await hydrated(page);
			const after = await seen(page);
			const expected = [`top: ${device === 'desktop' ? 'default' : device} content`, `below: ${device === 'mobile' ? 'mobile' : 'default'} content`];
			expect(before).toEqual(expected);
			expect(after).toEqual(expected);
			expect(problems.errors).toEqual([]);
			expect(problems.warnings).toEqual([]);
			const tree = await dom(page);
			await context.close();
			return { before, after, tree };
		});
	}

	differential(get, 'setClientUserAttributes switches the shown variant live, and writes the cookie', async (sdk) => {
		const { context, page, problems } = await visitor();
		await page.goto(servers.origin(sdk) + '/client-personalization');
		await hydrated(page);
		const steps: unknown[] = [await seen(page)];
		for (const device of ['tablet', 'mobile', 'desktop', 'tablet']) {
			await page.locator(`[data-attrs="${device}"]`).click();
			const top = `top: ${device === 'desktop' ? 'default' : device} content`;
			await until(async () => (await seen(page)).includes(top), 5000, top);
			expect(await attrs_cookie(context)).toEqual({ device });
			steps.push(await seen(page), await dom(page));
		}
		expect(problems.errors).toEqual([]);
		await context.close();
		return steps;
	});

	differential(get, 'builder.variantLoaded on mount; builder.variantDisplayed once a container is in view', async (sdk) => {
		const { context, page, problems } = await visitor({ device: 'mobile' });
		await page.goto(servers.origin(sdk) + '/client-personalization');
		await hydrated(page);
		await until(async () => (await events(page)).length >= 3, 5000, 'loaded ×2 + displayed (top)');
		await page.waitForTimeout(300);
		const first = await events(page);
		expect(first.filter((e: any) => e[0] === 'builder.variantDisplayed').map((e: any) => e[1])).toEqual(['builder-top']);
		await page.evaluate(() => document.querySelector('[builder-id="builder-below"]')!.scrollIntoView());
		await until(async () => (await events(page)).length > first.length, 5000, 'displayed (below)');
		await page.waitForTimeout(300);
		const all = await events(page);
		expect(all).toContainEqual(['builder.variantDisplayed', 'builder-below', 'mobile', 'client-personalization']);
		expect(problems.errors).toEqual([]);
		await context.close();
		return all;
	});

	differential(get, '/variant-containers (official spec): setClientUserAttributes before mount picks the tablet variant', async (sdk) => {
		const { context, page, problems } = await visitor();
		await page.goto(servers.origin(sdk) + '/variant-containers');
		await hydrated(page);
		await until(() => page.getByText('My tablet content').first().isVisible(), 5000, 'tablet content');
		const tree = await dom(page);
		expect(await attrs_cookie(context)).toEqual({ device: 'tablet' });
		expect(problems.errors).toEqual([]);
		await context.close();
		return tree;
	});
});
