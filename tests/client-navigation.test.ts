// SvelteKit client-side navigation between Builder pages (the catchall route renders a different
// content per path), the official build against ours (and ours in Svelte's async mode): after each
// navigation the page must be what a fresh load of it is — the same DOM, the same Builder <style>s
// (none left from the page before), the same scroll / message listeners on window and document
// (none left either: a scrollInView animation that never ran, an editor listener) — still
// interactive, with its own impression tracked. No full reload anywhere.
// (tests/content-swap.test.ts covers a new content object in one <Content>.)
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { Page } from 'playwright';
import { differential, dom, fresh, hydrated, offline, pair_built, serve, until, type Captured, type Sdk, type Servers } from './client-harness.js';

let servers: Servers;
const get = () => servers;

/** What a page is, to compare a navigated-to page with a fresh load of it. */
async function state_of(page: Page) {
	const cdp = await page.context().newCDPSession(page);
	const listeners: Record<string, number> = {};
	for (const target of ['window', 'document']) {
		const { result } = await cdp.send('Runtime.evaluate', { expression: target });
		const { listeners: list } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
		// (the SDKs' kinds; not builder.variant* — /client-personalization's own listeners, for the page's life)
		for (const l of list) if (/^(scroll|message|resize)$|^builder:/.test(l.type)) listeners[`${target}:${l.type}`] = (listeners[`${target}:${l.type}`] ?? 0) + 1;
	}
	await cdp.detach();
	const styles = await page.evaluate(() =>
		[...document.querySelectorAll('style')]
			.map((s) => s.textContent!.replace(/\s+/g, ' ').trim())
			.filter((t) => t.includes('builder'))
			.sort()
	);
	return { tree: await dom(page), styles, listeners };
}

/** Client-side navigation: a link inside the app (SvelteKit's router takes the click). */
async function navigate(page: Page, path: string) {
	await page.evaluate((path) => {
		const a = document.createElement('a');
		a.href = path;
		a.textContent = 'go';
		document.querySelector('main')!.append(a);
		a.click();
		a.remove(); // (the router has taken the click; the route's <main> stays across navigations)
	}, path);
	await page.waitForURL((u) => u.pathname === path);
	await hydrated(page);
	await page.waitForTimeout(200);
}

const impressions = (requests: Captured[]) =>
	requests.filter((r) => r.url.endsWith('/api/v1/track')).flatMap((r) => (r.body as { events: { type: string; data: { contentId?: string } }[] }).events.filter((e) => e.type === 'impression').map((e) => e.data.contentId));

/** Fresh loads of every page in `paths`, in a new context each: the reference. */
async function fresh_states(sdk: Sdk, paths: string[]) {
	const out: Record<string, Awaited<ReturnType<typeof state_of>>> = {};
	for (const path of new Set(paths)) {
		const { context, page } = await fresh(servers, { viewport: { width: 1100, height: 800 } });
		await offline(context);
		await context.addInitScript(() => (Math.random = () => 0.99));
		await page.goto(servers.origin(sdk) + path);
		await hydrated(page);
		await page.waitForTimeout(200);
		out[path] = await state_of(page);
		await context.close();
	}
	return out;
}

/** Walks `paths` by client-side navigation; each step against a fresh load of it. */
async function walk(sdk: Sdk, paths: string[], check?: (page: Page, path: string) => Promise<void>) {
	const reference = await fresh_states(sdk, paths);
	const { context, page, problems } = await fresh(servers, { viewport: { width: 1100, height: 800 } });
	const requests = await offline(context);
	await context.addInitScript(() => (Math.random = () => 0.99));
	await page.goto(servers.origin(sdk) + paths[0]);
	await hydrated(page);
	await page.waitForTimeout(200);
	await page.evaluate(() => ((window as unknown as { __same_document: boolean }).__same_document = true));
	const steps: unknown[] = [];
	for (let i = 0; i < paths.length; i++) {
		if (i) await navigate(page, paths[i]);
		expect(await page.evaluate(() => (window as unknown as { __same_document?: boolean }).__same_document)).toBe(true); // no reload
		const now = await state_of(page);
		// the navigated-to page is the page itself: nothing from the page before
		expect(now.styles, `${paths[i]}: styles`).toEqual(reference[paths[i]].styles);
		expect(now.listeners, `${paths[i]}: listeners`).toEqual(reference[paths[i]].listeners);
		expect(now.tree, `${paths[i]}: DOM`).toBe(reference[paths[i]].tree);
		await check?.(page, paths[i]);
		// (the official SDK has a <style> per block, ours one sheet: their counts are not compared)
		steps.push({ path: paths[i], listeners: now.listeners });
	}
	await until(() => impressions(requests).length >= paths.filter((p) => p !== '/track-conversion').length, 5000, 'an impression per page').catch(() => undefined);
	expect(problems.errors.filter((e) => !/Failed code evaluation/.test(e))).toEqual([]);
	expect(problems.warnings).toEqual([]);
	const result = { steps, impressions: impressions(requests) };
	await context.close();
	return result;
}

describe.skipIf(!pair_built)('client-side navigation between Builder pages leaves nothing behind', () => {
	beforeAll(async () => {
		servers = await serve(4545);
	});
	afterAll(async () => {
		await servers?.close();
	});

	// official bug: a scrollInView animation's document `scroll` listener is never removed — not when
	// its block unmounts (a navigation away), and not after it ran (removed without the `capture` it
	// was added with). Regression for ours: none left after leaving /animations.
	differential(
		get,
		'animations → hover → accordion → tabs: styles, listeners and DOM of each page only',
		async (sdk) =>
			walk(sdk, ['/animations', '/hover-animation', '/accordion', '/tabs'], async (page, path) => {
			// still interactive after arriving client-side
			if (path === '/accordion') {
				await page.getByText('Item 1', { exact: true }).click();
				await until(() => page.getByText('Inside Item 1', { exact: true }).isVisible(), 5000, 'accordion opens');
				await page.getByText('Item 1', { exact: true }).click();
				await until(async () => !(await page.getByText('Inside Item 1', { exact: true }).isVisible()), 5000, 'accordion closes');
			}
			if (path === '/tabs') {
				await page.getByText('Tab 2', { exact: true }).click();
				await until(() => page.getByText('inside tab 2').isVisible(), 5000, 'tab 2');
				await page.getByText('Tab 1', { exact: true }).click();
				await until(() => page.getByText('inside tab 1').isVisible(), 5000, 'tab 1');
			}
			}),
		{ official_known: "a scrollInView animation's document scroll listener outlives its page" }
	);

	differential(get, 'reactive state → show/hide → columns → back to reactive state: fresh state each time', async (sdk) =>
		walk(sdk, ['/reactive-state', '/show-hide-if', '/columns', '/reactive-state'], async (page, path) => {
			if (path === '/reactive-state') {
				await page.getByText('Increment Number').click();
				await until(() => page.getByText('1', { exact: true }).isVisible(), 5000, 'incremented');
				// (left incremented: the next visit must start from 0 again — the fresh load says so)
				await page.getByText('Increment Number').click();
				await until(() => page.getByText('2', { exact: true }).isVisible(), 5000, 'incremented twice');
			}
		})
	);

	// (/client-personalization, not the /variant-containers spec: that page sets its user attributes
	// in the catchall route's script, which a navigation between two catchall paths does not re-run)
	differential(get, 'A/B test → symbols → personalization → home', async (sdk) =>
		walk(sdk, ['/ab-test', '/symbols', '/client-personalization', '/'])
	);
});
