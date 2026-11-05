// The editor bridge, inside an editor-shaped parent frame, the official build against ours (and ours
// in Svelte's async mode): builder.evaluate replies (a value, a thrown error, a promise, arguments),
// builder.configureSdk breakpoints changing the media queries live, builder.resetState, a
// contentUpdate for another model ignored, messages from an untrusted origin ignored (and a custom
// trustedHosts), subscribeToEditor, builder:component:stateChange, and editing an empty content.
// Pages: e2e/app/src/routes/client-bridge and client-subscribe.
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { Frame } from 'playwright';
import { BRIDGE_PAGE, edited_page } from '../e2e/app/src/routes/client-bridge/contents.js';
import { differential, dom, in_editor, pair_built, serve, until, type Message, type Sdk, type Servers } from './client-harness.js';

let servers: Servers;
const get = () => servers;

const text = (frame: Frame) => frame.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
const has = (frame: Frame, s: string) => until(async () => (await text(frame)).includes(s), 5000, JSON.stringify(s));
const update = (model: string, data: unknown) => ({ type: 'builder.contentUpdate', data: { key: model, data } });
/** The messages after the first `skip`, only of these types. */
const replies = (messages: Message[], types: string[]) => messages.filter((m) => types.includes(m?.type));

/** Opens the bridge page in the editor; `untrusted`: the parent is served from 127.0.0.1. */
const editor = (sdk: Sdk, route = '/client-bridge', untrusted = false) =>
	in_editor(servers, sdk, route, untrusted ? { parent_origin: servers.origin(sdk, '127.0.0.1') } : {});

describe.skipIf(!pair_built)('the editor bridge behaves the same in the browser', () => {
	beforeAll(async () => {
		servers = await serve(4535);
	});
	afterAll(async () => {
		await servers?.close();
	});

	differential(get, 'builder.evaluate: a value, arguments, a thrown error, a promise — the same replies', async (sdk) => {
		const e = await editor(sdk);
		await has(e.frame, 'count: 0');
		const evaluate = (id: string, text: string, args?: unknown[]) => e.post({ type: 'builder.evaluate', data: { id, text, arguments: args } });
		await evaluate('sync', 'return 1 + 2');
		await evaluate('args', 'return arguments[0] * arguments[1]', [6, 7]);
		await evaluate('throws', 'throw new Error("boom")');
		await evaluate('promise', 'return new Promise((r) => setTimeout(() => r({ ok: [1, 2] }), 50))');
		await evaluate('dom', 'return document.querySelector("[builder-id=builder-count]").textContent.trim()');
		const types = ['builder.evaluateResult', 'builder.evaluateError'];
		await until(async () => replies(await e.messages(), types).length === 5, 5000, '5 replies');
		const got = replies(await e.messages(), types).sort((a, b) => a.data.id.localeCompare(b.data.id));
		expect(got).toEqual([
			{ type: 'builder.evaluateResult', data: { id: 'args', result: 42 } },
			{ type: 'builder.evaluateResult', data: { id: 'dom', result: 'count: 0 / initial' } },
			{ type: 'builder.evaluateResult', data: { id: 'promise', result: { ok: [1, 2] } } },
			{ type: 'builder.evaluateResult', data: { id: 'sync', result: 3 } },
			{ type: 'builder.evaluateError', data: { id: 'throws', error: 'boom' } }
		]);
		expect(e.problems.errors).toEqual([]);
		await e.context.close();
		return got;
	});

	differential(get, 'builder.configureSdk: new breakpoints change the media queries live; another content id is ignored', async (sdk) => {
		const e = await editor(sdk);
		await has(e.frame, 'breakpoints');
		const color_at = async (width: number) => {
			await e.page.evaluate((w) => (document.querySelector('iframe')!.style.width = w + 'px'), width);
			await e.frame.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
			return e.frame.locator('[builder-id="builder-bp"]').evaluate((el) => getComputedStyle(el).color);
		};
		const widths = [350, 500, 800, 1100];
		const colors = async () => {
			const out: string[] = [];
			for (const w of widths) out.push(await color_at(w));
			return out;
		};
		const before = await colors();
		expect(before).toEqual(['rgb(0, 0, 255)', 'rgb(0, 0, 255)', 'rgb(0, 128, 0)', 'rgb(255, 0, 0)']);
		await e.post({ type: 'builder.configureSdk', data: { contentId: 'not-this-one', breakpoints: { small: 400, medium: 700 } } });
		await e.page.waitForTimeout(300);
		const ignored = await colors();
		expect(ignored).toEqual(before);
		await e.post({ type: 'builder.configureSdk', data: { contentId: BRIDGE_PAGE.id, breakpoints: { small: 400, medium: 700 } } });
		await until(async () => (await color_at(500)) === 'rgb(0, 128, 0)', 5000, 'the new medium breakpoint');
		const after = await colors();
		expect(after).toEqual(['rgb(0, 0, 255)', 'rgb(0, 128, 0)', 'rgb(255, 0, 0)', 'rgb(255, 0, 0)']);
		expect(e.problems.errors).toEqual([]);
		await e.context.close();
		return { before, ignored, after };
	});

	differential(get, 'builder.resetState: merged into the root state of its model only', async (sdk) => {
		const e = await editor(sdk);
		await has(e.frame, 'count: 0 / initial');
		await e.post({ type: 'builder.resetState', data: { model: 'header', state: { count: 99 } } });
		await e.page.waitForTimeout(300);
		expect(await text(e.frame)).toContain('count: 0 / initial');
		await e.post({ type: 'builder.resetState', data: { model: 'page', state: { count: 5 } } });
		await has(e.frame, 'count: 5 / initial'); // (merged: `label` kept)
		const tree = await dom(e.frame);
		expect(e.problems.errors).toEqual([]);
		await e.context.close();
		return tree;
	});

	// official bug: after the editor's builder.resetState, the page's next action starts from the state
	// as it was BEFORE the reset (count 5, one click → 1, not 6): the action writes a stale copy.
	differential(
		get,
		"builder.resetState, then the page's own action: it acts on the reset state",
		async (sdk) => {
			const e = await editor(sdk);
			await has(e.frame, 'count: 0 / initial');
			await e.post({ type: 'builder.resetState', data: { model: 'page', state: { count: 5 } } });
			await has(e.frame, 'count: 5 / initial');
			await e.frame.getByText('Increment', { exact: true }).click();
			const after = await until(async () => {
				const t = await text(e.frame);
				return !t.includes('count: 5 /') && t;
			}, 5000, 'the click');
			if (sdk === 'official') expect(after).toContain('count: 1 / initial'); // (the bug, recorded)
			else expect(after).toContain('count: 6 / initial');
			expect(e.problems.errors).toEqual([]);
			await e.context.close();
			return after;
		},
		{ official_known: 'an action after builder.resetState starts from the pre-reset state' }
	);

	differential(get, 'builder.contentUpdate: applied for its model, ignored for another', async (sdk) => {
		const e = await editor(sdk);
		await has(e.frame, 'count: 0');
		await e.post(update('footer', edited_page('for the footer')));
		await e.page.waitForTimeout(300);
		expect(await text(e.frame)).not.toContain('for the footer');
		await e.post(update('page', edited_page('for the page')));
		await has(e.frame, 'for the page');
		const tree = await dom(e.frame);
		expect(e.problems.errors).toEqual([]);
		await e.context.close();
		return tree;
	});

	differential(get, 'an untrusted parent (127.0.0.1): evaluate, contentUpdate, resetState, triggerAnimation all ignored', async (sdk) => {
		const e = await editor(sdk, '/client-bridge', true);
		await has(e.frame, 'count: 0');
		await e.post({ type: 'builder.evaluate', data: { id: 'x', text: 'return 1' } });
		await e.post(update('page', edited_page('from an untrusted parent')));
		await e.post({ type: 'builder.resetState', data: { model: 'page', state: { count: 7 } } });
		await e.post({ type: 'builder.configureSdk', data: { contentId: BRIDGE_PAGE.id, breakpoints: { small: 1, medium: 2 } } });
		await e.page.waitForTimeout(600);
		const body = await text(e.frame);
		expect(body).toContain('count: 0 / initial');
		expect(body).not.toContain('untrusted');
		const answered = replies(await e.messages(), ['builder.evaluateResult', 'builder.evaluateError']);
		expect(answered).toEqual([]);
		// (the page still announced itself to its parent)
		expect(replies(await e.messages(), ['builder.sdkInfo'])).toHaveLength(1);
		expect(e.problems.errors).toEqual([]);
		await e.context.close();
		return body;
	});

	differential(get, 'trustedHosts: ["127.0.0.1"] trusts that parent; trustedHosts: [] trusts none', async (sdk) => {
		const trusted = await in_editor(servers, sdk, '/client-bridge?trusted=127.0.0.1', { parent_origin: servers.origin(sdk, '127.0.0.1') });
		await has(trusted.frame, 'count: 0');
		await trusted.post(update('page', edited_page('trusted by name')));
		await has(trusted.frame, 'trusted by name');
		await trusted.post({ type: 'builder.evaluate', data: { id: 'y', text: 'return "yes"' } });
		await until(async () => replies(await trusted.messages(), ['builder.evaluateResult']).length === 1, 5000, 'the reply');
		await trusted.context.close();
		// none: not even localhost (the frame's own origin)
		const none = await in_editor(servers, sdk, '/client-bridge?trusted=');
		await has(none.frame, 'count: 0');
		await none.post(update('page', edited_page('should not show')));
		await none.page.waitForTimeout(500);
		const body = await text(none.frame);
		expect(body).not.toContain('should not show');
		expect(none.problems.errors).toEqual([]);
		await none.context.close();
		return body;
	});

	differential(get, 'builder:component:stateChange: on state changes, and when the editor asks', async (sdk) => {
		const e = await editor(sdk);
		await has(e.frame, 'count: 0');
		await e.frame.evaluate(() => {
			const w = window as unknown as { __state_events: unknown[] };
			w.__state_events = [];
			addEventListener('builder:component:stateChange', (ev) => w.__state_events.push((ev as CustomEvent).detail));
		});
		const events = () => e.frame.evaluate(() => (window as unknown as { __state_events: { state: { count: number } }[] }).__state_events);
		await e.frame.getByText('Increment', { exact: true }).click();
		await until(async () => (await events()).some((d) => d.state.count === 1), 5000, 'a stateChange for count 1');
		await e.frame.evaluate(() => dispatchEvent(new CustomEvent('builder:component:stateChangeListenerActivated')));
		await e.page.waitForTimeout(300);
		const all = (await events()) as unknown as { state: Record<string, unknown>; ref: { name: string } }[];
		// regression: the editor asking (stateChangeListenerActivated) is answered by every content, even
		// with its state unchanged since its last report (ours answered nothing then)
		const answered = all.slice(-2).map((d) => d.ref.name).sort();
		expect(answered).toEqual(['header', 'page']);
		expect(all.slice(-2).find((d) => d.ref.name === 'page')).toMatchObject({ state: { count: 1, label: 'initial' } });
		expect(e.problems.errors).toEqual([]);
		await e.context.close();
		// (what the editor last heard from each model; how many reports before differs — ours does not
		// repeat an unchanged state on its own)
		const last = new Map<string, unknown>();
		for (const d of all) last.set(d.ref.name, d);
		return [...last.entries()].sort();
	});

	differential(get, 'editing empty content: a hidden wrapper, then the editor fills it', async (sdk) => {
		const e = await editor(sdk, '/client-bridge?c=empty');
		await e.frame.waitForSelector('[builder-model="page"]', { state: 'attached' });
		await e.page.waitForTimeout(300);
		const before = await e.frame.locator('[builder-model="page"]').evaluate((el) => ({ display: getComputedStyle(el).display, html: el.innerHTML.replace(/<!--.*?-->/g, '').trim() }));
		expect(before.display).toBe('none');
		await e.post(update('page', BRIDGE_PAGE));
		await has(e.frame, 'breakpoints');
		const after = await e.frame.locator('[builder-model="page"]').evaluate((el) => getComputedStyle(el).display);
		expect(after).not.toBe('none');
		// (an editor update brings blocks, not initial state: content.data.state is read once, at start)
		expect(await text(e.frame)).toContain('count: undefined / undefined');
		const tree = await dom(e.frame);
		expect(e.problems.errors).toEqual([]);
		await e.context.close();
		return { before: before.display, after, tree };
	});

	differential(get, 'subscribeToEditor: the callback gets each update of its model, until stopped', async (sdk) => {
		const e = await editor(sdk, '/client-subscribe');
		const received = () => e.frame.locator('[data-received] li').allTextContents();
		await e.frame.waitForSelector('[data-received]', { state: 'attached' });
		await e.post(update('page', { id: 'one', data: { title: 'first' } }));
		await e.post(update('other', { id: 'nope', data: { title: 'other model' } }));
		await e.post(update('page', { id: 'two', data: { title: 'second' } }));
		await until(async () => (await received()).length === 2, 5000, 'two updates');
		await e.frame.locator('[data-stop]').click();
		await e.post(update('page', { id: 'three', data: { title: 'after stop' } }));
		await e.page.waitForTimeout(300);
		const got = await received();
		expect(got).toEqual(['{"id":"one","title":"first"}', '{"id":"two","title":"second"}']);
		// it announced itself like a <Content> does
		const info = replies(await e.messages(), ['builder.sdkInfo']);
		expect(info.map((m) => m.data.modelName)).toEqual(['page']);
		expect(e.problems.errors).toEqual([]);
		await e.context.close();
		return { got, info: info.map((m) => ({ ...m.data, version: typeof m.data.version })) };
	});
});
