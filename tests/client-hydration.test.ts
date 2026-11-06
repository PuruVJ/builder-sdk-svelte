// Hydration of every official e2e spec page (e2e/suite/src/specs, rendered by the app's catchall
// route) in the official build, ours, and ours in Svelte's async mode:
//   - no page error, no console error, no Svelte hydration warning — official's are recorded
//     (printed), ours must be none;
//   - ours: the server's `[builder-id]` elements ARE the hydrated page — none re-created, none
//     dropped (a MutationObserver marks every element the HTML parser makes, before any app code).
// Math.random is pinned (0.99: an A/B test's default content wins, as with no test at all).
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAllPathnames } from '../e2e/suite/src/specs/index.js';
import { ALL, built, fresh, hydrated, offline, pair_built, serve, type Problems, type Sdk, type Servers } from './client-harness.js';

let servers: Servers;
const PAGES = getAllPathnames('sveltekit');

/** Console errors a page logs by design in both SDKs (content bindings that read data the mocked API
 * does not return), not hydration problems. */
const EXPECTED = /Failed code evaluation|error fetching dynamic data|Failed to load resource/;

/** Marks every element the HTML parser creates (until the document is parsed): `__ssr`. */
function mark_server_nodes() {
	const mark = (n: Node) => {
		if (n.nodeType !== 1) return;
		(n as unknown as { __ssr: boolean }).__ssr = true;
		for (const c of (n as Element).querySelectorAll('*')) (c as unknown as { __ssr: boolean }).__ssr = true;
	};
	const observer = new MutationObserver((records) => {
		for (const r of records) r.addedNodes.forEach(mark);
	});
	observer.observe(document, { childList: true, subtree: true });
	document.addEventListener('readystatechange', () => {
		if (document.readyState !== 'loading') {
			observer.takeRecords().forEach((r) => r.addedNodes.forEach(mark));
			observer.disconnect();
		}
	});
}

type Visit = { problems: Problems; recreated: string[]; dropped: number; server: number };

async function visit(sdk: Sdk, path: string): Promise<Visit> {
	const { context, page, problems } = await fresh(servers);
	await offline(context);
	await context.addInitScript(() => (Math.random = () => 0.99));
	await context.addInitScript(mark_server_nodes);
	// every VISIBLE [builder-id] the server sent, remembered as parsed (the hidden ones are the A/B
	// variants that lost: both SDKs unmount them after hydration)
	await context.addInitScript(() => {
		const w = window as unknown as { __server_nodes: Element[] };
		w.__server_nodes = [];
		document.addEventListener('readystatechange', () => {
			if (document.readyState === 'interactive') w.__server_nodes = [...document.querySelectorAll('[builder-id]')].filter((el) => !el.closest('[hidden]'));
		});
	});
	await page.goto(servers.origin(sdk) + path);
	await hydrated(page);
	await page.waitForTimeout(150);
	const nodes = await page.evaluate(() => {
		const w = window as unknown as { __server_nodes: Element[] };
		const live = [...document.querySelectorAll('[builder-id]')];
		return {
			// in the page now, but not made by the HTML parser: re-created on the client
			recreated: live.filter((el) => !(el as unknown as { __ssr?: boolean }).__ssr).map((el) => el.getAttribute('builder-id')!),
			// sent by the server, no longer in the page
			dropped: w.__server_nodes.filter((el) => !el.isConnected).length,
			server: w.__server_nodes.length
		};
	});
	await context.close();
	return { problems, ...nodes };
}

/** Visits every page, a few at a time. */
async function visit_all(sdk: Sdk) {
	const out: Record<string, Visit> = {};
	const queue = [...PAGES];
	await Promise.all(
		Array.from({ length: 6 }, async () => {
			for (let path = queue.shift(); path; path = queue.shift()) out[path] = await visit(sdk, path);
		})
	);
	return out;
}

const problems_of = (visits: Record<string, Visit>) =>
	Object.fromEntries(
		Object.entries(visits)
			.map(([path, v]) => [path, [...v.problems.errors.filter((e) => !EXPECTED.test(e)), ...v.problems.warnings]] as const)
			.filter(([, list]) => list.length)
	);

/**
 * Pages whose content is meant to change on the client, so some server elements are replaced:
 * each with why. Anything else re-creating or dropping a server element is a hydration bug.
 */
const PERSONALIZATION_RESET =
	"a PersonalizationContainer: after mount the server's markup (every variant, a script picks one) is replaced by the one variant the visitor's attributes pick (the official reset approach for Svelte)";
const CLIENT_CHANGES: Record<string, string> = {
	'/variant-containers': PERSONALIZATION_RESET,
	'/variant-containers-with-previewing-index-0': PERSONALIZATION_RESET,
	'/variant-containers-with-previewing-index-1': PERSONALIZATION_RESET,
	'/variant-containers-with-previewing-index-undefined': PERSONALIZATION_RESET
};

describe.skipIf(!pair_built)(`every spec page hydrates cleanly (${PAGES.length} pages)`, () => {
	beforeAll(async () => {
		servers = await serve(4540);
	});
	afterAll(async () => {
		await servers?.close();
	});

	const visits: Partial<Record<Sdk, Record<string, Visit>>> = {};
	for (const sdk of ALL) {
		it.skipIf(!built(sdk))(
			`${sdk}: no page error, console error or hydration warning${sdk === 'official' ? ' (recorded)' : ''}`,
			async () => {
				visits[sdk] = await visit_all(sdk);
				const found = problems_of(visits[sdk]!);
				if (sdk === 'official') {
					for (const [path, list] of Object.entries(found)) console.info(`[official] ${path}: ${list.join(' | ').slice(0, 300)}`);
					return;
				}
				expect(found).toEqual({});
			},
			300_000
		);
	}

	for (const sdk of ALL) {
		it.skipIf(!built(sdk))(`${sdk}: the server's builder-id elements are the hydrated page (none re-created or dropped)${sdk === 'official' ? ' (recorded)' : ''}`, async () => {
			const v = visits[sdk] ?? (visits[sdk] = await visit_all(sdk));
			const changed = Object.fromEntries(
				Object.entries(v)
					.filter(([path, x]) => !(path in CLIENT_CHANGES) && (x.recreated.length || x.dropped))
					.map(([path, x]) => [path, { recreated: x.recreated.slice(0, 5), recreated_count: x.recreated.length, dropped: x.dropped, of: x.server }])
			);
			if (sdk === 'official') {
				for (const [path, x] of Object.entries(changed)) console.info(`[official] ${path}: ${x.recreated_count} re-created, ${x.dropped} of ${x.of} dropped`);
				return;
			}
			expect(changed).toEqual({});
			// and the pages that do change on the client still hydrated what they could
			expect(Object.values(v).reduce((n, x) => n + x.server, 0)).toBeGreaterThan(0);
		}, 300_000);
	}
});
