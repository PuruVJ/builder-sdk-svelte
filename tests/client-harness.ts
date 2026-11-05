// Shared by the tests/client-*.test.ts browser tests: the e2e app (e2e/app) served once per SDK build,
// and the page plumbing every differential check needs. Not a test file itself.
//
// Builds: `pnpm build && pnpm e2e:build` (official + ours) and `pnpm e2e:build:async` (ours-async).
// A test file asks for the builds it needs; a missing build skips (never fails) what needs it.
import { expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Frame, type Page, type Request } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { normalize } from './normalize.js';

export const ROOT = path.resolve(import.meta.dirname, '..');
export type Sdk = 'official' | 'ours' | 'ours-async';
export const ALL: Sdk[] = ['official', 'ours', 'ours-async'];
export const built = (sdk: Sdk) => fs.existsSync(path.join(ROOT, `e2e/app/build-${sdk}`));
/** The pair every differential check needs. */
export const pair_built = built('official') && built('ours');

async function up(port: number) {
	for (let i = 0; i < 200; i++) {
		try {
			await fetch(`http://localhost:${port}/`);
			return;
		} catch {
			await new Promise((r) => setTimeout(r, 50));
		}
	}
	throw new Error(`no server on ${port}`);
}

export interface Servers {
	/** the SDK builds being served (those built, of the ones asked for) */
	sdks: Sdk[];
	/** http://localhost:<port> of one SDK's server */
	origin(sdk: Sdk, host?: string): string;
	browser: Browser;
	close(): Promise<void>;
}

/**
 * Serves each built SDK of `sdks` on its own port (`base` + its index in ALL) and launches a browser.
 * Ports must be unique per test file (files run in parallel): this suite owns 4500–4599.
 */
export async function serve(base: number, sdks: Sdk[] = ALL): Promise<Servers> {
	const live = sdks.filter(built);
	const procs: ChildProcess[] = [];
	const port = (sdk: Sdk) => base + ALL.indexOf(sdk);
	// (a server left over from an aborted run would answer instead of the fresh build)
	for (const sdk of live) {
		const taken = await fetch(`http://localhost:${port(sdk)}/`).then(
			() => true,
			() => false
		);
		if (taken) throw new Error(`port ${port(sdk)} is already in use (a server left from an earlier run?)`);
	}
	for (const sdk of live) {
		procs.push(
			spawn(process.execPath, [path.join(ROOT, `e2e/app/build-${sdk}`)], {
				env: { ...process.env, PORT: String(port(sdk)) },
				stdio: 'ignore'
			})
		);
	}
	await Promise.all(live.map((sdk) => up(port(sdk))));
	const browser = await chromium.launch();
	return {
		sdks: live,
		origin: (sdk, host = 'localhost') => `http://${host}:${port(sdk)}`,
		browser,
		async close() {
			await browser.close();
			for (const p of procs) p.kill();
		}
	};
}

/**
 * One behaviour, one test per SDK build: `run` drives the page and returns what it observed (its own
 * assertions hold the behaviour itself). Official runs first; every other build must observe exactly
 * what official did. `official_known`: an official SDK bug — its run is recorded (logged), not failed,
 * and ours is held to its own assertions only. `compare` replaces the equality check.
 */
export function differential<T>(
	get: () => Servers,
	name: string,
	run: (sdk: Sdk, servers: Servers) => Promise<T>,
	opts: { timeout?: number; sdks?: Sdk[]; official_known?: string; compare?: (theirs: T, official: T) => void } = {}
) {
	const results: Partial<Record<Sdk, T>> = {};
	for (const sdk of opts.sdks ?? ALL) {
		it.skipIf(!built(sdk))(
			`${name} [${sdk}]`,
			async () => {
				if (sdk === 'official' && opts.official_known) {
					// (a run that returns still records the bug: `compare` asserts what official did)
					let failure = '';
					try {
						results.official = await run(sdk, get());
					} catch (err) {
						failure = `\n  official run failed: ${String(err).split('\n')[0]}`;
					}
					console.info(`[official, known bug] ${name}: ${opts.official_known}${failure}`);
					return;
				}
				const result = await run(sdk, get());
				if (sdk === 'official') results.official = result;
				else if ('official' in results) {
					if (opts.compare) opts.compare(result, results.official as T);
					else if (!opts.official_known) expect(result).toEqual(results.official);
				}
			},
			opts.timeout ?? 60_000
		);
	}
}

/** What went wrong on a page: thrown errors, console errors, and Svelte's (production) warnings. */
export interface Problems {
	errors: string[];
	warnings: string[];
}

/** Collects a page's problems (all its frames). */
export function watch(page: Page): Problems {
	const problems: Problems = { errors: [], warnings: [] };
	page.on('pageerror', (e) => problems.errors.push('pageerror: ' + e.message));
	page.on('console', (m) => {
		const text = m.text();
		if (m.type() === 'error') problems.errors.push('console: ' + text);
		// (production Svelte warns with a link: https://svelte.dev/e/hydration_mismatch)
		else if (m.type() === 'warning' && /svelte\.dev\/e\/|hydrat/i.test(text)) problems.warnings.push(text);
	});
	return problems;
}

export interface Captured {
	url: string;
	method: string;
	headers: Record<string, string>;
	body: unknown;
}

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

export const capture = (req: Request): Captured => {
	let body: unknown = req.postData();
	try {
		body = body == null ? null : JSON.parse(body as string);
	} catch {
		/* not JSON */
	}
	return { url: req.url(), method: req.method(), headers: req.headers(), body };
};

/**
 * Keeps the page off the network: every request to *.builder.io (tracking, the content API, images)
 * is recorded and answered here — `respond` may answer a request itself (return a body, or
 * `undefined` for the default: `{}` for the API, a 1×1 png for images).
 */
export async function offline(
	target: Page | BrowserContext,
	respond?: (req: Captured) => { status?: number; json?: unknown; body?: string; contentType?: string } | undefined
): Promise<Captured[]> {
	const seen: Captured[] = [];
	await target.route(/^https?:\/\/([a-z0-9-]+\.)*builder\.io\//, async (route) => {
		const req = capture(route.request());
		seen.push(req);
		const answer = respond?.(req);
		if (req.method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
		if (answer) {
			return route.fulfill({
				status: answer.status ?? 200,
				headers: cors,
				contentType: answer.contentType ?? (answer.json !== undefined ? 'application/json' : 'text/plain'),
				body: answer.json !== undefined ? JSON.stringify(answer.json) : (answer.body ?? '')
			});
		}
		if (/\/api\//.test(req.url)) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{}' });
		return route.fulfill({ status: 200, headers: cors, contentType: 'image/png', body: PIXEL });
	});
	return seen;
}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

/** A fresh, isolated browser context (own cookies + storage) and a page in it, its problems watched. */
export async function fresh(servers: Servers, options: Parameters<Browser['newContext']>[0] = {}) {
	const context = await servers.browser.newContext(options);
	const page = await context.newPage();
	const problems = watch(page);
	return { context, page, problems };
}

/** A fresh context + page of one SDK's app at `route`, off the network (`offline`), hydrated. */
export async function open_page(
	servers: Servers,
	sdk: Sdk,
	route: string,
	{ context_options, before }: { context_options?: Parameters<Browser['newContext']>[0]; before?: (context: BrowserContext, page: Page) => Promise<void> } = {}
) {
	const { context, page, problems } = await fresh(servers, context_options);
	const requests = await offline(context);
	await before?.(context, page);
	await page.goto(servers.origin(sdk) + route);
	await hydrated(page);
	return { context, page, problems, requests };
}

/** Waits until the page's SvelteKit app has started (hydrated, its onMount run). */
export async function hydrated(page: Page | Frame) {
	// `load` waits for the route's modulepreloads; SvelteKit's start() then stamps history.state just
	// before it hydrates (from those cached modules) — a couple of frames later the app is mounted.
	await page.waitForLoadState('load');
	await page.waitForFunction(() => history.state?.['sveltekit:history'] != null);
	await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));
}

/** Polls `fn` until it returns a truthy value (or throws after `timeout`). */
export async function until<T>(fn: () => Promise<T> | T, timeout = 10_000, what = 'condition'): Promise<T> {
	const start = Date.now();
	let last: unknown;
	for (;;) {
		try {
			const value = await fn();
			if (value) return value;
			last = value;
		} catch (err) {
			last = err;
		}
		if (Date.now() - start > timeout) throw new Error(`timed out waiting for ${what} (last: ${String(last)})`);
		await new Promise((r) => setTimeout(r, 25));
	}
}

export type Message = { type: string; data?: any };

/**
 * The page inside an editor-shaped parent frame. The parent is a blank page the app serves
 * (e2e/app/src/routes/client-editor-shell) at `parent_origin` — the frame's own origin by default,
 * i.e. a trusted `localhost` editor; `http://127.0.0.1:<port>` makes an untrusted one (both
 * loopback, so Chrome's local-network checks let it frame localhost).
 * Every message the page posts to its parent is recorded in `messages()`.
 */
export async function in_editor(
	servers: Servers,
	sdk: Sdk,
	route: string,
	{ parent_origin, wait = true, context_options }: { parent_origin?: string; wait?: boolean; context_options?: Parameters<Browser['newContext']>[0] } = {}
) {
	const { context, page, problems } = await fresh(servers, context_options);
	await page.goto(`${parent_origin ?? servers.origin(sdk)}/client-editor-shell`);
	const ready = page.evaluate(() => {
		(window as any).__messages = [];
		addEventListener('message', (e) => (window as any).__messages.push(e.data));
		return new Promise<void>((resolve) => addEventListener('message', (e) => e.data?.type === 'builder.sdkInfo' && resolve()));
	});
	const sep = route.includes('?') ? '&' : '?';
	const src = `${servers.origin(sdk)}${route}${sep}builder.frameEditing=page`;
	await page.evaluate((src) => {
		const frame = document.createElement('iframe');
		frame.src = src;
		frame.style.cssText = 'width:1200px;height:900px;border:0';
		document.body.append(frame);
	}, src);
	if (wait) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		await Promise.race([
			ready,
			new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`no builder.sdkInfo from ${src}`)), 15_000)))
		]).finally(() => clearTimeout(timer));
	}
	const path_only = route.split('?')[0];
	const frame = await until(() => page.frames().find((f) => f !== page.mainFrame() && new URL(f.url()).pathname === path_only), 10_000, 'the frame');
	await frame.waitForLoadState('load');
	return {
		context,
		page,
		frame,
		problems,
		messages: () => page.evaluate(() => (window as any).__messages as Message[]),
		/** posts a message to the frame FROM THE PARENT (event.origin is the parent's) */
		post: (message: unknown) =>
			page.evaluate((message) => document.querySelector('iframe')!.contentWindow!.postMessage(message, '*'), message as never)
	};
}

/** The live DOM under `selector` (default: the app's <main>), through normalize.ts — the normal form
 * the server-render equivalence test compares (hydration comments, Svelte scope classes and
 * whitespace dropped; <style> pulled out). */
export async function dom(page: Page | Frame, selector = 'main'): Promise<string> {
	const html = await page.evaluate((s) => {
		const root = document.querySelector(s);
		if (!root) return '(missing)';
		// inline styles in the browser's own serialization (`outline:none` and `outline: none` are one style)
		const copy = root.cloneNode(true) as Element;
		for (const el of copy.querySelectorAll<HTMLElement>('[style]')) el.setAttribute('style', el.style.cssText);
		return copy.innerHTML;
	}, selector);
	return normalize(html).tree;
}

