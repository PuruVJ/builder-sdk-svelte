/**
 * EDITOR FUZZ: a seeded random sequence of visual-editor messages (builder.contentUpdate,
 * builder.resetState, builder.configureSdk) posted into a page inside an editor-shaped frame must
 * leave the page looking exactly like a FRESH load of the content the editor ended up with.
 *
 * - The page: e2e/app/src/routes/editor-fuzz (a `page` <Content> plus a stateful `Counter` custom
 *   component); the content is POSTed to /editor-fuzz/store and loaded by key, so the fresh render is
 *   a real SSR + hydration of the final content. Builds with SVELTE_ASYNC=1 use /async/editor-fuzz
 *   (the same, with the content behind an `await`).
 * - The edits and the model of what the SDK holds after each message: tests/editor-fuzz.gen.ts.
 * - Compared (live frame vs fresh frame, at 3 frame widths, after every EDITOR_FUZZ_CHECK_EVERY
 *   steps and at the end): the element tree (tag, attributes with class tokens sorted and Svelte
 *   scope classes dropped, style declarations sorted), text, the computed layout/paint styles of every
 *   element, and the visible text. <style>/<script>, comments and whitespace are not compared.
 * - Also recorded, NOT asserted: whether a Counter whose block and position did not change kept its
 *   mount (its internal state) across each edit — printed per SDK and edit kind.
 *
 * Runs against every built SDK (official first — it validates the test), needs `pnpm e2e:build`
 * (+ `pnpm e2e:build:async` / `e2e:build:official:async` for the async builds). Env:
 *   EDITOR_FUZZ_SEEDS=4 | 1,7,42   number of seeds (1..N) or the exact seeds
 *   EDITOR_FUZZ_SEED=7             exactly this one seed (what a failure prints)
 *   EDITOR_FUZZ_STEPS=25           edits per seed
 *   EDITOR_FUZZ_CHECK_EVERY=5      compare with a fresh render every N steps (0 = only at the end)
 *   EDITOR_FUZZ_SDKS=official,ours,official-async,ours-async   which builds (default: all built)
 *   EDITOR_FUZZ_KINDS=all | text,move,...   edit kinds (default: those the official SDK shows, see gen)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Frame, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Fuzz, KINDS, blocks, type Content, type Message } from './editor-fuzz.gen.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORTS: Record<string, number> = { official: 4451, ours: 4452, 'official-async': 4453, 'ours-async': 4454 };
const built = (sdk: string) => fs.existsSync(path.join(ROOT, `e2e/app/build-${sdk}`));
const SDKS = (process.env.EDITOR_FUZZ_SDKS?.split(',') ?? Object.keys(PORTS)).filter((s) => s in PORTS && built(s));
const seeds_env = process.env.EDITOR_FUZZ_SEED ?? process.env.EDITOR_FUZZ_SEEDS ?? '4';
const SEEDS = process.env.EDITOR_FUZZ_SEED || seeds_env.includes(',') ? seeds_env.split(',').map(Number) : Array.from({ length: Number(seeds_env) }, (_, i) => i + 1);
const STEPS = Number(process.env.EDITOR_FUZZ_STEPS ?? 25);
const CHECK_EVERY = Number(process.env.EDITOR_FUZZ_CHECK_EVERY ?? 5);
const KINDS_ENV = process.env.EDITOR_FUZZ_KINDS;
const KIND_LIST = KINDS_ENV === 'all' ? Object.keys(KINDS) : KINDS_ENV?.split(',');
const WIDTHS = [1100, 820, 560];

let browser: Browser;
const servers: ChildProcess[] = [];
/** sdk → kind → [kept, remounted] for Counters whose block and position an edit did not change. */
const remounts: Record<string, Record<string, [number, number]>> = {};
/** sdk → the edits that remounted such a Counter (seed, step, edit, counter). */
const remount_events: Record<string, string[]> = {};

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

/** Runs IN a frame: the page under [data-fuzz-root], normalised to one line per node. */
function snapshot_in_frame(): string {
	const PROPS = [
		'display', 'position', 'visibility', 'box-sizing', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content',
		'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
		'width', 'max-width', 'background-color', 'color', 'font-size', 'text-align'
	];
	const SKIP_TAGS = new Set(['style', 'script', 'template', 'noscript', 'link']);
	const SKIP_ATTRS = new Set(['data-instance', 'data-svelte-h']);
	const root = document.querySelector('[data-fuzz-root]');
	if (!root) return '(no [data-fuzz-root])';
	const out: string[] = ['visible text: ' + JSON.stringify((root as HTMLElement).innerText.replace(/\s+/g, ' ').trim())];
	const attr = (a: Attr) => {
		if (a.name === 'class') {
			const t = a.value.split(/\s+/).filter((c) => c && !/^svelte-[a-z0-9]+$/.test(c)).sort();
			return t.length ? `class="${t.join(' ')}"` : null;
		}
		if (a.name === 'style') {
			// Through the browser's own parser: a server-rendered attribute keeps the text as written
			// (`calc(100% - 0px)`, an invalid `max-width:1200`), one set from the client is re-serialised
			// (`calc(100% + 0px)`, invalid values dropped) — the same style either way.
			const s = (document.createElement('div') as HTMLElement).style;
			s.cssText = a.value;
			const d = [...Array(s.length).keys()].map((i) => `${s[i]}:${s.getPropertyValue(s[i])}${s.getPropertyPriority(s[i]) ? '!important' : ''}`).sort();
			return d.length ? `style="${d.join(';')}"` : null;
		}
		return `${a.name}="${a.value}"`;
	};
	const walk = (el: Element, depth: number) => {
		const pad = '  '.repeat(depth);
		for (const n of el.childNodes) {
			if (n.nodeType === 3) {
				if (n.parentElement?.closest('[data-fuzz-ignore]')) continue;
				const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
				if (t) out.push(pad + JSON.stringify(t));
				continue;
			}
			if (n.nodeType !== 1) continue;
			const e = n as Element;
			if (SKIP_TAGS.has(e.localName)) continue;
			const attrs = [...e.attributes].filter((a) => !SKIP_ATTRS.has(a.name)).map(attr).filter(Boolean).sort();
			const cs = getComputedStyle(e);
			out.push(`${pad}<${e.localName}${attrs.length ? ' ' + attrs.join(' ') : ''}> {${PROPS.map((p) => cs.getPropertyValue(p)).join('|')}}`);
			walk(e, depth + 1);
		}
	};
	walk(root, 0);
	return out.join('\n');
}

/** Runs IN a frame: a cheap signature, to see when rendering has settled. */
const signature_in_frame = () => {
	const root = document.querySelector('[data-fuzz-root]');
	return (root?.innerHTML.length ?? -1) + ':' + [...document.querySelectorAll('style')].reduce((n, s) => n + (s.textContent?.length ?? 0), 0);
};

async function settle(frame: Frame) {
	// Editor messages may be coalesced per animation frame (with a timeout fallback): wait out a few
	// frames, then until the DOM stops changing.
	await frame.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60)))));
	let last = '';
	let same = 0;
	for (let i = 0; i < 60 && same < 3; i++) {
		const sig = await frame.evaluate(signature_in_frame);
		same = sig === last ? same + 1 : 0;
		last = sig;
		await new Promise((r) => setTimeout(r, 40));
	}
}

type Run = { page: Page; live: Frame; fresh_frame: () => Frame; errors: string[] };

async function open(port: number, route: string, first: Content): Promise<Run> {
	const page = await browser.newPage({ viewport: { width: 2400, height: 1600 } });
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => m.type() === 'error' && errors.push(`console.error: ${m.text()}`));
	await store(port, 'live', first);
	// (same origin as the frame: localhost is a default trusted host, and Chrome lets it frame itself)
	const editor = `http://localhost:${port}/__fuzz_editor`;
	await page.route(editor, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0"></body>' }));
	await page.goto(editor);
	await page.evaluate((src) => {
		const w = window as any;
		w.__msgs = [];
		const mk = (name: string, left: number) => {
			const f = document.createElement('iframe');
			f.name = name;
			f.style.cssText = `position:absolute;top:0;left:${left}px;width:1100px;height:1500px;border:0`;
			document.body.append(f);
			return f;
		};
		const live = mk('live', 0);
		const fresh = mk('fresh', 1200);
		addEventListener('message', (e) => {
			const from = e.source === live.contentWindow ? 'live' : e.source === fresh.contentWindow ? 'fresh' : '?';
			w.__msgs.push({ from, type: e.data?.type });
		});
		live.src = src;
	}, `http://localhost:${port}${route}?c=live&builder.frameEditing=page`);
	await wait_sdk(page, 'live', 0);
	const live = page.frame({ name: 'live' })!;
	await settle(live);
	return { page, live, fresh_frame: () => page.frame({ name: 'fresh' })!, errors };
}

async function wait_sdk(page: Page, from: string, after: number) {
	await page.waitForFunction(
		([from, after]) => (window as any).__msgs.slice(after).some((m: any) => m.from === from && m.type === 'builder.sdkInfo'),
		[from, after] as const,
		{ timeout: 15_000 }
	);
}

async function store(port: number, key: string, content: Content) {
	const r = await fetch(`http://localhost:${port}/editor-fuzz/store?key=${key}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(content)
	});
	if (!r.ok) throw new Error(`store ${r.status}`);
}

async function post(page: Page, msg: Message) {
	await page.evaluate((msg) => (document.querySelector('iframe[name=live]') as HTMLIFrameElement).contentWindow!.postMessage(msg, '*'), msg);
}

async function set_width(page: Page, width: number) {
	await page.evaluate((w) => document.querySelectorAll('iframe').forEach((f) => (f.style.width = w + 'px')), width);
}

/** The first difference between two snapshots, with context. */
function diff(a: string, b: string): string {
	const x = a.split('\n');
	const y = b.split('\n');
	let i = 0;
	while (i < x.length && i < y.length && x[i] === y[i]) i++;
	const from = Math.max(0, i - 4);
	const show = (ls: string[]) => ls.slice(from, i + 6).map((l, k) => (from + k === i ? '> ' : '  ') + l.slice(0, 260)).join('\n');
	return `first difference at line ${i + 1} (live ${x.length} lines, fresh ${y.length} lines)\n--- live (after the edits)\n${show(x)}\n--- fresh render of the final content\n${show(y)}`;
}

/** Live vs a fresh load of the model's content, at every width. Returns the failure text, or null. */
async function compare(run: Run, port: number, route: string, fuzz: Fuzz): Promise<string | null> {
	const key = `fresh-${fuzz.seed}-${Math.random().toString(36).slice(2)}`;
	await store(port, key, fuzz.fresh());
	const after = await run.page.evaluate(() => (window as any).__msgs.length);
	await run.page.evaluate((src) => ((document.querySelector('iframe[name=fresh]') as HTMLIFrameElement).src = src), `http://localhost:${port}${route}?c=${key}&builder.frameEditing=page`);
	await wait_sdk(run.page, 'fresh', after);
	const fresh = run.fresh_frame();
	await settle(fresh);
	try {
		for (const width of WIDTHS) {
			await set_width(run.page, width);
			await settle(run.live);
			await settle(fresh);
			const [a, b] = [await run.live.evaluate(snapshot_in_frame), await fresh.evaluate(snapshot_in_frame)];
			if (a !== b) return `at frame width ${width}px: ${diff(a, b)}`;
		}
		return null;
	} finally {
		await set_width(run.page, WIDTHS[0]);
	}
}

/** Counter block id → mount number, as the live frame shows them. */
const counters = (frame: Frame) =>
	frame.evaluate(() =>
		Object.fromEntries([...document.querySelectorAll('.fuzz-counter')].map((c) => [c.closest('[builder-id]')?.getAttribute('builder-id'), (c as HTMLElement).dataset.instance]))
	) as Promise<Record<string, string | undefined>>;

/** Counter id → its block JSON + slot path: an edit that keeps both should not remount it. */
const counter_places = (content: Content) =>
	Object.fromEntries(blocks(content).filter((f) => f.block.component?.name === 'Counter').map((f) => [f.block.id, JSON.stringify(f.block) + '@' + f.path + '#' + f.slot?.key]));

describe.skipIf(SDKS.length === 0)('editor fuzz: live edits look like a fresh render', () => {
	beforeAll(async () => {
		for (const sdk of SDKS) {
			servers.push(spawn(process.execPath, [path.join(ROOT, `e2e/app/build-${sdk}`)], { env: { ...process.env, PORT: String(PORTS[sdk]) }, stdio: 'ignore' }));
			await up(PORTS[sdk]);
		}
		browser = await chromium.launch();
	});
	afterAll(async () => {
		await browser?.close();
		for (const s of servers) s.kill();
		for (const [sdk, kinds] of Object.entries(remounts)) {
			const rows = Object.entries(kinds).map(([k, [kept, re]]) => `${k}: kept ${kept}, remounted ${re}`);
			console.log(`[editor-fuzz] ${sdk}: unchanged Counters across edits — ${rows.join('; ') || 'none seen'}`);
			for (const e of (remount_events[sdk] ?? []).slice(0, 10)) console.log(`[editor-fuzz] ${sdk}:   ${e}`);
		}
	});

	for (const sdk of SDKS) {
		const route = sdk.endsWith('-async') ? '/async/editor-fuzz' : '/editor-fuzz';
		describe(sdk, () => {
			for (const seed of SEEDS) {
				it(`seed ${seed}`, { timeout: 60_000 + STEPS * 4000 }, async () => {
					const port = PORTS[sdk];
					const fuzz = new Fuzz(seed, KIND_LIST);
					const run = await open(port, route, fuzz.editor);
					const log: string[] = [];
					const stats = (remounts[sdk] ??= {});
					const repro = `EDITOR_FUZZ_SDKS=${sdk} EDITOR_FUZZ_SEED=${seed} EDITOR_FUZZ_STEPS=${STEPS} EDITOR_FUZZ_CHECK_EVERY=1${KINDS_ENV ? ` EDITOR_FUZZ_KINDS=${KINDS_ENV}` : ''} pnpm test:editor-fuzz`;
					const fail = (at: string, why: string) => {
						throw new Error(`[editor-fuzz] ${sdk} seed ${seed} ${at}\nedits:\n${log.map((l, i) => `  ${i + 1}. ${l}`).join('\n')}\n${why}\nreproduce: ${repro}`);
					};
					try {
						const base = await compare(run, port, route, fuzz);
						if (base) fail('before any edit (the page vs a fresh load of the same content)', base);
						for (let i = 1; i <= STEPS; i++) {
							const places = counter_places(fuzz.editor);
							const before = await counters(run.live);
							const { kind, desc, msg } = fuzz.step();
							log.push(`[${kind}] ${desc}`);
							await post(run.page, msg);
							await settle(run.live);
							const after = await counters(run.live);
							const now = counter_places(fuzz.editor);
							for (const [id, place] of Object.entries(places)) {
								if (now[id] !== place || !before[id] || !after[id]) continue;
								const s = (stats[kind] ??= [0, 0]);
								s[before[id] === after[id] ? 0 : 1]++;
								if (before[id] !== after[id]) {
									(remount_events[sdk] ??= []).push(`seed ${seed} step ${i} ${log[log.length - 1]} → remounted ${id}`);
									// Ours is held to it (official is only recorded): an edit that left a component's
									// block and place alone must not remount it — that would lose its state.
									if (sdk.startsWith('ours')) fail(`after step ${i}`, `remounted ${id}, whose block and place the edit did not change`);
								}
							}
							if (run.errors.length) fail(`after step ${i}`, `errors in the page:\n${run.errors.join('\n')}`);
							if ((CHECK_EVERY > 0 && i % CHECK_EVERY === 0) || i === STEPS) {
								const d = await compare(run, port, route, fuzz);
								if (d) fail(`after step ${i}`, d);
							}
						}
						expect(run.errors).toEqual([]);
					} finally {
						await run.page.close();
					}
				});
			}
		});
	}
});
