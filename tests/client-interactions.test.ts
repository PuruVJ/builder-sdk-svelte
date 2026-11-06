// The built-in blocks' client behaviour, the official build against ours (and ours in Svelte's async
// mode): the same DOM after every interaction, the same requests, the same events.
//   Accordion (open / close / oneAtATime / grid), Tabs (switching, collapsible), Form (typing, submit:
//   the request, its success / error / sending states, presubmit + submit:success + submit:error),
//   Video (autoplay / muted / controls, lazy load), Image (lazy load, the srcset candidate the browser
//   picks), Columns (laid out at 3 viewport widths), Section lazyLoad.
// Pages: the official e2e specs (/accordion, /tabs, /columns, …) and e2e/app/src/routes/client-blocks.
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { Page, Route } from 'playwright';
import { capture, differential, dom, fresh, hydrated, offline, pair_built, ROOT, serve, until, type Captured, type Sdk, type Servers } from './client-harness.js';

let servers: Servers;
const get = () => servers;
const VIDEO_MP4 = fs.readFileSync(path.join(ROOT, 'e2e/suite/src/mocks/video.mp4'));

/** A page of one SDK's app, off the network (builder.io answered locally; videos get a real mp4). */
async function open(sdk: Sdk, route: string, options: Parameters<typeof fresh>[1] = {}) {
	const { context, page, problems } = await fresh(servers, options);
	const requests = await offline(context);
	await context.route(/cdn\.builder\.io\/o\//, (r) => {
		requests.push(capture(r.request()));
		return r.fulfill({ status: 200, contentType: 'video/mp4', body: VIDEO_MP4 });
	});
	await page.goto(servers.origin(sdk) + route);
	await hydrated(page);
	return { context, page, problems, requests };
}

const visible = (page: Page, text: string) => page.getByText(text, { exact: true }).isVisible();

describe.skipIf(!pair_built)('built-in blocks behave the same in the browser', () => {
	beforeAll(async () => {
		servers = await serve(4500);
	});
	afterAll(async () => {
		await servers?.close();
	});

	// ── Accordion ──────────────────────────────────────────────────────────────────────────────
	// official bug: a title's class comes from a function call the official (Svelte 4-style, legacy
	// mode) template never re-runs, so an open item's title keeps `builder-accordion-title-closed`.
	// Ours switches it to `-open`. Compared with that class token masked; asserted for ours.
	const TITLE_STATE_RE = /builder-accordion-title-(open|closed)/g;
	const mask_titles = (v: unknown) => JSON.parse(JSON.stringify(v).replace(TITLE_STATE_RE, 'builder-accordion-title-STATE'));
	const accordion = { compare: (ours: unknown, official: unknown) => expect(mask_titles(ours)).toEqual(mask_titles(official)) };
	/** which titles say they are open (class), which details are visible */
	const accordion_state = async (page: Page) => ({
		titles_open: await page.evaluate(() => [...document.querySelectorAll('.builder-accordion-title')].map((t) => t.classList.contains('builder-accordion-title-open'))),
		details: await Promise.all([1, 2, 3].map((i) => visible(page, `Inside Item ${i}`)))
	});
	const check_titles = (sdk: Sdk, state: { titles_open: boolean[]; details: boolean[] }) => {
		if (sdk === 'official') expect(state.titles_open).toEqual([false, false, false]); // (the bug, recorded)
		else expect(state.titles_open).toEqual(state.details);
	};

	differential(
		get,
		'Accordion: items open and close, details below their title',
		async (sdk) => {
			const { context, page, problems } = await open(sdk, '/accordion');
			const steps: unknown[] = [await dom(page)];
			for (let i = 1; i <= 3; i++) {
				await page.getByText(`Item ${i}`, { exact: true }).click();
				await until(() => visible(page, `Inside Item ${i}`), 5000, `Inside Item ${i}`);
				const title = (await page.getByText(`Item ${i}`, { exact: true }).boundingBox())!;
				const detail = (await page.getByText(`Inside Item ${i}`, { exact: true }).boundingBox())!;
				expect(detail.y).toBeGreaterThan(title.y + title.height - 1);
				const state = await accordion_state(page);
				check_titles(sdk, state);
				steps.push(await dom(page), state.details);
			}
			for (let i = 1; i <= 3; i++) {
				await page.getByText(`Item ${i}`, { exact: true }).click();
				await until(async () => !(await visible(page, `Inside Item ${i}`)), 5000, `Inside Item ${i} hidden`);
				const state = await accordion_state(page);
				check_titles(sdk, state);
				steps.push(await dom(page), state.details);
			}
			expect(problems.errors).toEqual([]);
			await context.close();
			return steps;
		},
		accordion
	);

	differential(
		get,
		'Accordion oneAtATime: opening one closes the others',
		async (sdk) => {
			const { context, page, problems } = await open(sdk, '/accordion-one-at-a-time');
			const steps: unknown[] = [];
			for (const i of [1, 2, 3, 1]) {
				await page.getByText(`Item ${i}`, { exact: true }).click();
				await until(() => visible(page, `Inside Item ${i}`), 5000, `Inside Item ${i}`);
				const state = await accordion_state(page);
				expect(state.details).toEqual([1, 2, 3].map((j) => j === i));
				check_titles(sdk, state);
				steps.push(await dom(page));
			}
			expect(problems.errors).toEqual([]);
			await context.close();
			return steps;
		},
		accordion
	);

	differential(
		get,
		'Accordion grid: titles in a grid, the open detail ordered after its row',
		async (sdk) => {
			const { context, page, problems } = await open(sdk, '/accordion-grid');
			const order = () =>
				page.evaluate(() =>
					[...document.querySelectorAll('.builder-accordion-title, .builder-accordion-detail')].map((el) => ({
						cls: el.className.replace(/\s*svelte-[a-z0-9]+/g, '').trim(),
						order: getComputedStyle(el).order,
						width: getComputedStyle(el).width
					}))
				);
			const steps: unknown[] = [await order()];
			for (const i of [1, 3, 2]) {
				await page.getByText(`Item ${i}`, { exact: true }).click();
				await until(() => visible(page, `Inside Item ${i}`), 5000, `Inside Item ${i}`);
				const state = await accordion_state(page);
				expect(state.details).toEqual([1, 2, 3].map((j) => j === i)); // one at a time, regardless of oneAtATime
				check_titles(sdk, state);
				steps.push(await order(), await dom(page));
			}
			expect(problems.errors).toEqual([]);
			await context.close();
			return steps;
		},
		accordion
	);

	// ── Tabs ───────────────────────────────────────────────────────────────────────────────────
	const active_tab = (page: Page) => page.locator('.builder-tab-active').evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.trim()));

	// official bug: a tab's `activeTabStyle` comes from a function call the legacy-mode template never
	// re-runs, so the highlight stays on the default tab while another is active. Ours moves it.
	// Compared with the tab labels' inline style masked; asserted per SDK.
	const TAB_STYLE_RE = /(<span class="[^"]*builder-tab-wrap[^"]*") style="[^"]*"/g;
	const tab_highlight = (page: Page) =>
		page.locator('.builder-tab-wrap').evaluateAll((els) => els.map((e) => (e as HTMLElement).style.backgroundColor !== ''));

	differential(
		get,
		'Tabs: the default tab, then switching',
		async (sdk) => {
			const { context, page, problems } = await open(sdk, '/tabs');
			expect(await active_tab(page)).toEqual(['Tab 1']);
			expect(await tab_highlight(page)).toEqual([true, false, false]);
			const steps = [await dom(page)];
			for (const i of [2, 3, 1]) {
				await page.getByText(`Tab ${i}`, { exact: true }).click();
				await until(() => visible(page, `inside tab ${i}`), 5000, `inside tab ${i}`);
				expect(await active_tab(page)).toEqual([`Tab ${i}`]);
				for (const j of [1, 2, 3]) if (j !== i) expect(await page.getByText(`inside tab ${j}`).count()).toBe(0);
				// (official: the highlight never leaves Tab 1 — the bug, recorded)
				expect(await tab_highlight(page)).toEqual([1, 2, 3].map((j) => (sdk === 'official' ? j === 1 : j === i)));
				steps.push(await dom(page));
			}
			expect(problems.errors).toEqual([]);
			await context.close();
			return steps;
		},
		{ compare: (ours, official) => expect(ours.map((s) => s.replace(TAB_STYLE_RE, '$1'))).toEqual(official.map((s) => s.replace(TAB_STYLE_RE, '$1'))) }
	);

	// official bug: collapsing (clicking the active tab of a `collapsible` Tabs) sets the active index to
	// -1, and the official template then reads `tabs[-1].content`: "Cannot read properties of undefined
	// (reading 'content')" — the tab never closes. Ours closes it.
	differential(
		get,
		'Tabs collapsible: clicking the active tab closes it, clicking again reopens',
		async (sdk) => {
			const { context, page, problems } = await open(sdk, '/client-blocks?c=tabs-collapsible');
			// (defaultActiveTab: 1 → the first tab)
			await until(() => visible(page, 'inside tab 1'), 5000, 'tab 1');
			const steps = [await dom(page)];
			await page.getByText('Tab 1', { exact: true }).click();
			await until(async () => (await page.getByText('inside tab 1').count()) === 0, 3000, 'tab 1 collapsed');
			expect(await active_tab(page)).toEqual([]);
			steps.push(await dom(page));
			await page.getByText('Tab 1', { exact: true }).click();
			await until(() => visible(page, 'inside tab 1'), 5000, 'tab 1 again');
			expect(await active_tab(page)).toEqual(['Tab 1']);
			steps.push(await dom(page));
			await page.getByText('Tab 2', { exact: true }).click();
			await until(() => visible(page, 'inside tab 2'), 5000, 'tab 2');
			steps.push(await dom(page));
			expect(problems.errors).toEqual([]);
			await context.close();
			return steps;
		},
		{ official_known: "collapsing throws `Cannot read properties of undefined (reading 'content')`; the tab stays open" }
	);

	// ── Form ───────────────────────────────────────────────────────────────────────────────────
	/** Fills one form of /client-blocks?c=forms, submits it, and returns what happened. */
	async function submit_form(sdk: Sdk, id: string, answer: (url: URL) => { status: number; json: unknown }) {
		const { context, page, problems, requests } = await open(sdk, '/client-blocks?c=forms');
		const submitted: Captured[] = [];
		let release!: () => void;
		const held = new Promise<void>((r) => (release = r));
		const respond = async (route: Route) => {
			const req = route.request();
			submitted.push({ url: req.url(), method: req.method(), headers: req.headers(), body: req.postData() });
			await held; // the "sending" state is observed first
			const { status, json } = answer(new URL(req.url()));
			await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
			answered = true;
		};
		let answered = false;
		await context.route('**/__submit/**', respond);
		await context.route('https://builder.io/api/v1/form-submit**', respond);

		await page.evaluate(() => {
			const w = window as unknown as { __events: unknown[] };
			w.__events = [];
			const summary = (v: unknown): unknown =>
				v instanceof FormData ? { formData: [...v.entries()].map(([k, x]) => [k, String(x)]) } : v instanceof Response ? { status: v.status } : v;
			for (const form of document.querySelectorAll('form'))
				for (const type of ['presubmit', 'submit:success', 'submit:error', 'route'])
					form.addEventListener(type, (e) => {
						const detail = (e as CustomEvent).detail ?? {};
						w.__events.push([form.getAttribute('name'), type, Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, summary(v)]))]);
					});
		});
		const form = page.locator(`form:has([builder-id="builder-${id}-submit"])`);
		const values = () =>
			form.evaluate((f) => [...f.querySelectorAll('input,select,textarea')].map((el) => (el as HTMLInputElement).type === 'checkbox' ? (el as HTMLInputElement).checked : (el as HTMLInputElement).value));
		const before = await values();

		// `required`: an empty name blocks the submit (no request, no event)
		await form.getByRole('button').click();
		await page.waitForTimeout(100);
		expect(submitted).toEqual([]);

		await form.locator('input[name="name"]').fill('Jane');
		await form.locator('input[name="email"]').fill('jane@doe.com');
		await form.locator('input[name="age"]').fill('42');
		await form.locator('input[name="agree"]').check();
		await form.locator('select[name="color"]').selectOption('blue');
		await form.locator('textarea[name="details"]').fill('hi there');
		const typed = await values();
		await form.getByRole('button').click();
		await until(() => submitted.length === 1, 5000, 'the submit request');
		// sending (the response is held until it shows; the official form never shows it — see below —
		// so it gets a short grace period, any other build 5s)
		const grace = sdk === 'official' ? 1000 : 5000;
		const sending_shown = await until(() => page.locator(`[data-msg="${id}-sending"]`).isVisible(), grace).catch(() => false);
		const sending = await dom(page, `form:has([builder-id="builder-${id}-submit"])`);
		release();
		await until(() => answered, 5000, 'the response');
		const result_shown = await until(
			async () => (await page.locator(`[data-msg="${id}-success"]`).count()) + (await page.locator(`[data-msg="${id}-error"]`).count()) > 0,
			grace
		).catch(() => false);
		await page.waitForTimeout(100);
		const req = submitted[0];
		const BOUNDARY_RE = /----WebKitFormBoundary[0-9A-Za-z]+/g;
		const url = new URL(req.url);
		const result = {
			before,
			typed,
			request: {
				path: url.host === 'builder.io' ? url.href : url.pathname + url.search,
				method: req.method,
				headers: Object.fromEntries(
					Object.entries(req.headers)
						.filter(([k]) => k === 'content-type' || k.startsWith('x-'))
						.map(([k, v]) => [k, v.replace(BOUNDARY_RE, 'BOUNDARY')])
				),
				body: typeof req.body === 'string' ? req.body.replace(BOUNDARY_RE, 'BOUNDARY') : req.body
			},
			sending_shown,
			sending,
			result_shown,
			after: await dom(page, `form:has([builder-id="builder-${id}-submit"])`),
			values_after: await values(),
			events: await page.evaluate(() => (window as unknown as { __events: unknown[] }).__events),
			builder_requests: requests.filter((r) => !/\/api\/v1\/(track|pixel)/.test(r.url)).map((r) => r.method + ' ' + r.url).sort()
		};
		expect(problems.errors.filter((e) => !e.includes('status of 400'))).toEqual([]);
		await context.close();
		return result;
	}

	const OK = () => ({ status: 200, json: { ok: true } });
	type FormRun = Awaited<ReturnType<typeof submit_form>>;

	// official bug: the official form never shows its sending / success / error message blocks — its
	// template reads the state through a function call (`submissionState()`) that the legacy-mode
	// template does not re-run. The request, the events, the reset all happen. So: those are compared;
	// the message blocks are asserted for ours only.
	const FORM_MESSAGES_BUG = 'the sending / success / error message blocks never render (state read through submissionState())';
	const without_messages = ({ sending_shown: _a, sending: _b, result_shown: _c, after: _d, ...rest }: FormRun) => rest;
	const form_compare = (ours: FormRun, official: FormRun) => {
		expect([official.sending_shown, official.result_shown]).toEqual([false, false]); // (the bug, recorded)
		expect(without_messages(ours)).toEqual(without_messages(official));
	};
	/** ours: the sending message while the request is out, then the result message */
	const check_messages = (sdk: Sdk, r: FormRun, id: string, result: 'success' | 'error') => {
		if (sdk === 'official') return;
		expect(r.sending_shown).toBe(true);
		expect(r.sending).toContain(`${id} sending`);
		expect(r.result_shown).toBe(true);
		expect(r.after).toContain(`${id} ${result}`);
		expect(r.after).not.toContain(`${id} sending`);
	};

	differential(
		get,
		'Form (JSON): required blocks, then one POST with the typed values; sending → success, reset',
		async (sdk) => {
			const r = await submit_form(sdk, 'json', OK);
			expect(r.request.method).toBe('POST');
			expect(r.request.path).toBe('/__submit/ok?kind=json');
			expect(r.request.headers).toEqual({ 'content-type': 'application/json', 'x-test': 'json' });
			expect(JSON.parse(r.request.body as string)).toEqual({ name: 'Jane', email: 'jane@doe.com', age: 42, agree: true, color: 'blue', details: 'hi there' });
			expect(r.events.map((e: any) => e[1])).toEqual(['presubmit', 'submit:success']);
			expect(r.values_after).toEqual(r.before); // resetFormOnSubmit (default): back to the defaults
			check_messages(sdk, r, 'json', 'success');
			return r;
		},
		{ official_known: FORM_MESSAGES_BUG, compare: form_compare }
	);

	differential(
		get,
		'Form (urlencoded, PUT): FormData body, the declared content type',
		async (sdk) => {
			const r = await submit_form(sdk, 'urlenc', OK);
			expect(r.request.method).toBe('PUT');
			expect(r.request.headers['content-type']).toBe('application/x-www-form-urlencoded');
			expect(r.events.map((e: any) => e[1])).toEqual(['presubmit', 'submit:success']);
			check_messages(sdk, r, 'urlenc', 'success');
			return r;
		},
		{ official_known: FORM_MESSAGES_BUG, compare: form_compare }
	);

	differential(
		get,
		'Form resetFormOnSubmit: false keeps the typed values',
		async (sdk) => {
			const r = await submit_form(sdk, 'noreset', OK);
			expect(r.values_after).toEqual(r.typed);
			check_messages(sdk, r, 'noreset', 'success');
			return r;
		},
		{ official_known: FORM_MESSAGES_BUG, compare: form_compare }
	);

	differential(
		get,
		'Form sendSubmissionsTo email: multipart POST to builder.io/api/v1/form-submit',
		async (sdk) => {
			const r = await submit_form(sdk, 'email', OK);
			expect(r.request.path).toBe(`https://builder.io/api/v1/form-submit?apiKey=abcd&to=${btoa('me@example.com')}&name=My%20form`);
			expect(r.request.headers['content-type']).toMatch(/^multipart\/form-data; boundary=BOUNDARY$/);
			check_messages(sdk, r, 'email', 'success');
			return r;
		},
		{ official_known: FORM_MESSAGES_BUG, compare: form_compare }
	);

	// official bug (2): on a non-2xx response the official form dispatches `submit:error` on
	// `formRef.nativeElement` (an Angular-ism; undefined in Svelte), so that event never fires. Ours
	// fires it on the form.
	differential(
		get,
		'Form error response: the error state, errorMessagePath into root state, submit:error',
		async (sdk) => {
			const r = await submit_form(sdk, 'fail', () => ({ status: 400, json: { detail: { msg: 'bad input' } } }));
			expect(r.events.map((e: any) => e[1])).toContain('presubmit');
			if (sdk !== 'official') {
				expect(r.events).toContainEqual(['fail', 'submit:error', { error: { detail: { msg: 'bad input' } }, status: 400 }]);
				check_messages(sdk, r, 'fail', 'error');
				expect(r.after).toContain('fail error: bad input'); // errorMessagePath → state.formErrorMessage
				expect(r.after).toContain('builder-form-error-text'); // the response, shown
			}
			return r;
		},
		{
			official_known: FORM_MESSAGES_BUG + '; submit:error is never dispatched on an error response',
			compare: (ours, official) => {
				expect(official.events.map((e: any) => e[1])).toEqual(['presubmit']); // (the bug, recorded)
				// official bug (3): the error sets root state (formErrorMessage), the official tree re-renders,
				// and its Form:Select drops the visitor's choice (value ''). Ours keeps every typed value.
				expect(official.values_after[4]).toBe('');
				expect(ours.values_after).toEqual(ours.typed);
				form_compare({ ...ours, values_after: official.values_after, events: ours.events.filter((e: any) => e[1] !== 'submit:error') }, official);
			}
		}
	);

	// ── Media: Image + Video + Section ─────────────────────────────────────────────────────────
	const media_state = (page: Page) =>
		page.evaluate(() => {
			const q = (id: string) => document.querySelector(`[builder-id="builder-${id}"]`);
			const video = (id: string) => {
				const v = q(id)?.querySelector('video') as HTMLVideoElement | null;
				if (!v) return null;
				const s = v.querySelector('source');
				return {
					autoplay: v.autoplay,
					muted: v.muted,
					controls: v.controls,
					loop: v.loop,
					playsInline: v.playsInline,
					preload: v.preload,
					source: s?.getAttribute('src') ?? null,
					data_src: s?.getAttribute('data-src') ?? null
				};
			};
			const img = (id: string) => {
				const i = q(id)?.querySelector('img') as HTMLImageElement | null;
				return i && { loading: i.loading, fetchPriority: i.getAttribute('fetchpriority'), sizes: i.sizes, srcset: i.srcset, complete: i.complete };
			};
			return {
				img_top: img('img-top'),
				img_priority: img('img-priority'),
				img_below: img('img-below'),
				video_top: video('video-top'),
				video_plain: video('video-plain'),
				video_below: video('video-below')
			};
		});

	differential(get, 'Image + Video: lazy media loads on scroll, autoplay/muted/controls, Section lazyLoad renders', async (sdk) => {
		const { context, page, problems, requests } = await open(sdk, '/client-blocks?c=media', { viewport: { width: 1200, height: 800 } });
		const media = () => requests.filter((r) => r.method === 'GET' && /clienttest/.test(r.url)).map((r) => r.url.replace(/^.*clienttest%2F/, ''));
		await until(() => media().some((u) => u.startsWith('top')), 5000, 'the top image');
		await page.waitForTimeout(300);
		const first = { requested: [...new Set(media())].sort(), state: await media_state(page) };
		expect(first.requested.some((u) => u.startsWith('below'))).toBe(false); // lazy, far below the fold
		expect(first.state.video_below!.source).toBe(null);
		expect(first.state.video_top!.autoplay && first.state.video_top!.muted && first.state.video_top!.controls).toBe(true);
		// (the autoplaying video's own file is fetched at once; headless Chromium has no H.264 to play it)
		expect(first.requested).toContain('top?alt=media');
		// Section lazyLoad (an official input with no effect in gen 2): rendered at once, server-side too
		const section = await page.evaluate(() => {
			const s = document.querySelector('[data-section-lazy]')?.closest('section');
			return s && { text: s.innerText.trim(), maxWidth: getComputedStyle(s).maxWidth, display: getComputedStyle(s).display };
		});
		const ssr = await (await fetch(servers.origin(sdk) + '/client-blocks?c=media')).text();
		expect(ssr).toContain('data-section-lazy');

		await page.evaluate(() => document.querySelector('[builder-id="builder-video-below"]')!.scrollIntoView());
		await until(() => media().some((u) => u.startsWith('below')), 5000, 'the lazy image');
		await until(() => page.evaluate(() => !!document.querySelector('[builder-id="builder-video-below"] source')?.getAttribute('src')), 5000, 'the lazy video source');
		await page.waitForTimeout(200);
		const after = { requested: [...new Set(media())].sort(), state: await media_state(page) };
		expect(after.state.video_below!.source).toContain('below?alt=media');
		expect(problems.errors).toEqual([]);
		await context.close();
		return { first, section, after };
	});

	for (const [width, dpr] of [
		[400, 2],
		[900, 1],
		[1600, 1]
	] as const) {
		differential(get, `Image srcset: the candidate the browser picks at ${width}px @${dpr}x`, async (sdk) => {
			const { context, page, requests } = await open(sdk, '/client-blocks?c=media', { viewport: { width, height: 800 }, deviceScaleFactor: dpr });
			const pick = () =>
				page.evaluate(() =>
					['img-top', 'img-priority'].map((id) => (document.querySelector(`[builder-id="builder-${id}"] img`) as HTMLImageElement).currentSrc)
				);
			const picked = await until(async () => {
				const p = await pick();
				return p.every(Boolean) && p;
			}, 5000, 'currentSrc');
			const requested = [...new Set(requests.filter((r) => /clienttest%2F(top|priority)/.test(r.url)).map((r) => r.url))].sort();
			await context.close();
			return { picked, requested };
		});
	}

	differential(get, 'Video (/video): every video the same element, lazy video sources set on scroll (/video-lazy-load)', async (sdk) => {
		const { context, page, problems } = await open(sdk, '/video');
		const videos = await page.evaluate(() =>
			[...document.querySelectorAll('video')].map((v) => ({
				autoplay: v.autoplay,
				muted: v.muted,
				controls: v.controls,
				preload: v.preload,
				css: ['object-fit', 'object-position', 'width', 'height', 'position'].map((p) => getComputedStyle(v).getPropertyValue(p))
			}))
		);
		const tree = await dom(page);
		await page.goto(servers.origin(sdk) + '/video-lazy-load');
		await hydrated(page);
		const src = () => page.evaluate(() => document.querySelector('video source')?.getAttribute('src') ?? null);
		const before = await src();
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		const after = await until(src, 5000, 'the lazy video source');
		expect(before).toBe(null);
		expect(problems.errors).toEqual([]);
		await context.close();
		return { videos, tree, before, after };
	});

	// ── Columns ────────────────────────────────────────────────────────────────────────────────
	for (const route of ['/columns', '/columns-with-different-widths']) {
		differential(get, `Columns ${route}: the same layout at 1200, 800 and 400px`, async (sdk) => {
			const { context, page, problems } = await open(sdk, route, { viewport: { width: 1200, height: 900 } });
			const layouts: unknown[] = [];
			for (const width of [1200, 800, 400]) {
				await page.setViewportSize({ width, height: 900 });
				await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
				layouts.push(
					await page.evaluate(() =>
						[...document.querySelectorAll('.builder-columns')].map((cols) => {
							const cs = getComputedStyle(cols);
							return {
								direction: cs.flexDirection,
								display: cs.display,
								columns: [...cols.children]
									.filter((c) => c.classList.contains('builder-column'))
									.map((c) => {
										const r = c.getBoundingClientRect();
										const s = getComputedStyle(c);
										return [Math.round(r.x), Math.round(r.width), s.marginLeft, s.width];
									})
							};
						})
					)
				);
			}
			// at 400px (mobile) the official `stackColumnsAt: 'tablet'` default stacks them
			expect((layouts[2] as { direction: string }[]).some((l) => l.direction === 'column')).toBe(true);
			expect((layouts[0] as { direction: string }[]).some((l) => l.direction === 'row')).toBe(true);
			expect(problems.errors).toEqual([]);
			await context.close();
			return layouts;
		});
	}
});
