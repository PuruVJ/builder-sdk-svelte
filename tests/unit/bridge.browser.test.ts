// @vitest-environment happy-dom
// internal/bridge.ts against the official functions/is-from-trusted-host.ts, scripts/init-editing.ts
// and helpers/subscribe-to-editor.ts: who is trusted, what the editor is told, what each message does.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rng } from './_rng.js';

type Ours = typeof import('../../src/lib/internal/bridge.js');
type Official = typeof import('../../node_modules/@builder.io/sdk-svelte/src/scripts/init-editing') &
	typeof import('../../node_modules/@builder.io/sdk-svelte/src/helpers/subscribe-to-editor') &
	typeof import('../../node_modules/@builder.io/sdk-svelte/src/functions/is-from-trusted-host');

let ours: Ours;
let official: Official;
let posted: unknown[];
const listeners: Array<(e: MessageEvent) => void> = [];

beforeEach(async () => {
	// fresh modules: both set up for editing once per page (a module-level flag)
	vi.resetModules();
	ours = await import('../../src/lib/internal/bridge.js');
	official = {
		...(await import('../../node_modules/@builder.io/sdk-svelte/src/scripts/init-editing')),
		...(await import('../../node_modules/@builder.io/sdk-svelte/src/helpers/subscribe-to-editor')),
		...(await import('../../node_modules/@builder.io/sdk-svelte/src/functions/is-from-trusted-host'))
	} as Official;
	posted = [];
	// (top window: window.parent is window) record posts instead of dispatching them
	vi.spyOn(window, 'postMessage').mockImplementation(((m: unknown) => void posted.push(m)) as never);
	const add = window.addEventListener.bind(window);
	vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, fn: never, opts?: never) => {
		if (type === 'message') listeners.push(fn);
		add(type, fn, opts);
	}) as never);
});
afterEach(() => {
	for (const l of listeners.splice(0)) window.removeEventListener('message', l);
	vi.restoreAllMocks();
});

const message = (data: unknown, origin = 'https://builder.io') => new MessageEvent('message', { data, origin });
const send = (data: unknown, origin?: string) => window.dispatchEvent(message(data, origin));

describe('is_from_trusted_host (official isFromTrustedHost)', () => {
	const origins = [
		'https://builder.io',
		'http://builder.io',
		'https://builder.io:8080',
		'https://beta.builder.io',
		'https://x.beta.builder.io',
		'https://a.b.beta.builder.io',
		'https://qa.builder.io',
		'http://localhost:3000',
		'http://localhost',
		'https://evilbuilder.io',
		'https://builder.io.evil.com',
		'https://xbeta.builder.io',
		'https://www.builder.io',
		'https://my.site.com',
		'https://sub.my.site.com',
		'https://BUILDER.IO',
		'null',
		'',
		'file://',
		'ftp://builder.io',
		'httpsx://builder.io',
		'https://xn--bder-jua.io'
	];
	const host_lists: Array<string[] | undefined> = [undefined, [], ['my.site.com'], ['*.my.site.com'], ['*.site.com', 'builder.io'], ['*.']];
	for (const hosts of host_lists)
		it(`hosts ${JSON.stringify(hosts)}`, () => {
			for (const origin of origins) expect(ours.is_from_trusted_host(hosts, { origin }), origin).toBe(official.isFromTrustedHost(hosts, { origin }));
		});

	it('an origin the official cannot parse (it throws) is untrusted here', () => {
		for (const origin of ['http', 'https:', 'http://', 'https://[::1', 'http-foo', 'https://exa mple.com']) {
			expect(() => official.isFromTrustedHost(undefined, { origin })).toThrow();
			expect(ours.is_from_trusted_host(undefined, { origin })).toBe(false);
		}
	});

	it('seeded sweep of hostnames', () => {
		const r = rng(77);
		const parts = ['builder', 'io', 'beta', 'qa', 'localhost', 'x', 'site', 'com', ''];
		for (let i = 0; i < 400; i++) {
			const host = Array.from({ length: 1 + r.int(4) }, () => r.pick(parts)).join('.');
			const origin = r.pick(['https://', 'http://']) + host + (r.chance(0.2) ? ':' + r.int(9999) : '');
			const hosts = r.chance(0.5) ? undefined : Array.from({ length: r.int(3) }, () => (r.chance(0.5) ? '*.' : '') + r.pick(parts) + '.' + r.pick(parts));
			let theirs: boolean | 'throws';
			try {
				theirs = official.isFromTrustedHost(hosts, { origin });
			} catch {
				theirs = 'throws';
			}
			expect(ours.is_from_trusted_host(hosts, { origin }), origin).toBe(theirs === 'throws' ? false : theirs);
		}
	});
});

describe('setup_browser_for_editing (official setupBrowserForEditing)', () => {
	const options = { modelName: 'page', apiKey: 'k', locale: 'de', enrich: true, trustedHosts: undefined };

	it('posts sdkInfo then updateContent, once per page', () => {
		ours.setup_browser_for_editing(options);
		ours.setup_browser_for_editing({ ...options, modelName: 'other' });
		const a = posted.splice(0);
		official.setupBrowserForEditing(options as never);
		official.setupBrowserForEditing({ ...options, modelName: 'other' } as never);
		expect(a).toEqual(posted);
		expect(a).toHaveLength(2);
		expect(a[0]).toMatchObject({ type: 'builder.sdkInfo', data: { target: 'svelte', version: '5.2.0', modelName: 'page' } });
	});

	/** Both sides' answers to the same editor messages (each side's listener alone on the page). */
	async function answers(messages: Array<[unknown, string?]>, trustedHosts?: string[]) {
		const run = async (setup: () => void) => {
			for (const l of listeners.splice(0)) window.removeEventListener('message', l);
			setup();
			posted.length = 0;
			for (const [data, origin] of messages) send(data, origin);
			await new Promise((r) => setTimeout(r, 0));
			return posted.splice(0);
		};
		return {
			ours: await run(() => ours.setup_browser_for_editing({ ...options, trustedHosts })),
			official: await run(() => official.setupBrowserForEditing({ ...options, trustedHosts } as never))
		};
	}

	it('builder.evaluate: a result, a thrown error, a resolved promise, arguments, untrusted, other types', async () => {
		const r = await answers([
			[{ type: 'builder.evaluate', data: { id: 1, text: 'return 1 + 1' } }],
			[{ type: 'builder.evaluate', data: { id: 2, text: 'return arguments[0] * arguments[1]', arguments: [6, 7] } }],
			[{ type: 'builder.evaluate', data: { id: 3, text: 'throw new Error("boom")' } }],
			[{ type: 'builder.evaluate', data: { id: 4, text: 'return Promise.resolve({ a: 1 })' } }],
			[{ type: 'builder.evaluate', data: { id: 5, text: 'return undefined' } }],
			[{ type: 'builder.evaluate', data: { id: 6, text: 'return 1' } }, 'https://evil.com'],
			[{ type: 'builder.other', data: { id: 7 } }],
			[null],
			['a string'],
			[{ type: 'builder.evaluate', data: { id: 8, text: 'return { thenable: true, then: 5 }' } }]
		]);
		expect(r.ours).toEqual(r.official);
		expect(r.ours).toEqual([
			{ type: 'builder.evaluateResult', data: { result: 2, id: 1 } },
			{ type: 'builder.evaluateResult', data: { result: 42, id: 2 } },
			{ type: 'builder.evaluateError', data: { id: 3, error: 'boom' } },
			{ type: 'builder.evaluateResult', data: { result: undefined, id: 5 } },
			{ type: 'builder.evaluateResult', data: { result: { thenable: true, then: 5 }, id: 8 } },
			{ type: 'builder.evaluateResult', data: { id: 4, result: { a: 1 } } }
		]);
	});

	it('a rejected promise is logged, not answered (official)', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const r = await answers([[{ type: 'builder.evaluate', data: { id: 1, text: 'return Promise.reject(new Error("no"))' } }]]);
		expect(r.ours).toEqual(r.official);
		expect(r.ours).toEqual([]);
		expect(err).toHaveBeenCalledTimes(2);
	});

	it('custom trusted hosts', async () => {
		const r = await answers(
			[
				[{ type: 'builder.evaluate', data: { id: 1, text: 'return 1' } }, 'https://builder.io'],
				[{ type: 'builder.evaluate', data: { id: 2, text: 'return 2' } }, 'https://cms.mine.com']
			],
			['*.mine.com']
		);
		expect(r.ours).toEqual(r.official);
		expect(r.ours).toEqual([{ type: 'builder.evaluateResult', data: { result: 2, id: 2 } }]);
	});

	it('code that does not compile: ours answers with an error (the official throws in its listener)', async () => {
		ours.setup_browser_for_editing(options);
		posted.length = 0;
		send({ type: 'builder.evaluate', data: { id: 9, text: 'return (' } });
		expect(posted).toEqual([{ type: 'builder.evaluateError', data: { id: 9, error: expect.stringMatching(/./) } }]);
	});

	it('an evaluate message without data: ours ignores it (the official throws)', () => {
		ours.setup_browser_for_editing(options);
		posted.length = 0;
		expect(() => ours && send({ type: 'builder.evaluate' })).not.toThrow();
		expect(posted).toEqual([{ type: 'builder.evaluateResult', data: { result: undefined, id: undefined } }]);
	});

	it('a parent that cannot be posted to is logged at debug', () => {
		vi.mocked(window.postMessage).mockImplementation(() => {
			throw new Error('detached');
		});
		const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
		expect(() => ours.setup_browser_for_editing(options)).not.toThrow();
		expect(debug).toHaveBeenCalledWith('Could not postmessage', expect.any(Error));
	});
});

describe('editor_listener (official createEditorListener)', () => {
	const MESSAGES: unknown[] = [
		{ type: 'builder.configureSdk', data: { breakpoints: { small: 500, medium: 900 }, contentId: 'c' } },
		{ type: 'builder.triggerAnimation', data: { elementId: 'builder-1', trigger: 'pageLoad' } },
		{ type: 'builder.resetState', data: { model: 'page', state: { a: 1 }, editType: 'client' } },
		{ type: 'builder.resetState', data: { model: 'other', state: { a: 1 } } },
		{ type: 'builder.resetState', data: { model: 'page' } },
		{ type: 'builder.contentUpdate', data: { key: 'page', data: { id: 'c', data: { blocks: [] } }, editType: 'server' } },
		{ type: 'builder.contentUpdate', data: { alias: 'page', data: { id: 'c2' } } },
		{ type: 'builder.contentUpdate', data: { entry: 'page', data: { id: 'c3' } } },
		{ type: 'builder.contentUpdate', data: { modelName: 'page', data: { id: 'c4' } } },
		{ type: 'builder.contentUpdate', data: { key: 'footer', modelName: 'page', data: { id: 'c5' } } },
		{ type: 'builder.contentUpdate', data: { modelName: 'footer', data: { id: 'c6' } } },
		{ type: 'builder.unknown', data: {} },
		null,
		0,
		'builder.contentUpdate',
		{}
	];
	const record = () => {
		const calls: unknown[][] = [];
		return {
			calls,
			callbacks: {
				contentUpdate: (...a: unknown[]) => void calls.push(['contentUpdate', ...a]),
				stateUpdate: (...a: unknown[]) => void calls.push(['stateUpdate', ...a]),
				animation: (...a: unknown[]) => void calls.push(['animation', ...a]),
				configureSdk: (...a: unknown[]) => void calls.push(['configureSdk', ...a])
			}
		};
	};
	for (const origin of ['https://builder.io', 'https://evil.com'])
		it(`dispatches per type and model, origin ${origin}`, () => {
			const a = record();
			const b = record();
			const listen_ours = ours.editor_listener('page', undefined, a.callbacks as never);
			const listen_official = official.createEditorListener({ model: 'page', trustedHosts: undefined as never, callbacks: b.callbacks as never });
			for (const data of MESSAGES) {
				listen_ours(message(data, origin));
				listen_official(message(data, origin));
			}
			expect(a.calls).toEqual(b.calls);
			if (origin === 'https://builder.io') expect(a.calls.map((c) => c[0])).toEqual(['configureSdk', 'animation', 'stateUpdate', 'contentUpdate', 'contentUpdate', 'contentUpdate', 'contentUpdate']);
		});

	it('messages without a payload: ours ignores them (the official passes undefined on, or throws)', () => {
		const a = record();
		const listen = ours.editor_listener('page', undefined, a.callbacks as never);
		for (const type of ['builder.configureSdk', 'builder.triggerAnimation', 'builder.resetState', 'builder.contentUpdate']) expect(() => listen(message({ type }))).not.toThrow();
		expect(a.calls).toEqual([]);
		expect(() => official.createEditorListener({ model: 'page', trustedHosts: undefined as never, callbacks: record().callbacks as never })(message({ type: 'builder.resetState' }))).toThrow();
	});
});

describe('post_component_infos (official EnableEditor registration)', () => {
	it('one builder.registerComponent per entry for the model, functions serialized, component stripped, ours-only skipped', async () => {
		const { NOT_IN_EDITOR } = await import('../../src/lib/internal/editor.js');
		const { createRegisterComponentMessage } = await import('../../node_modules/@builder.io/sdk-svelte/src/functions/register-component');
		const entries = [
			{ name: 'A', component: {}, inputs: [{ name: 'x', onChange: (o: unknown) => o }] },
			{ name: 'B', component: {}, models: ['page'] },
			{ name: 'C', component: {}, models: ['footer'] },
			{ name: 'D', component: {}, models: [] },
			{ name: 'E', component: {}, [NOT_IN_EDITOR]: true },
			{ name: 'F' }
		];
		ours.post_component_infos(entries as never, 'page');
		const expected = entries
			.filter((e) => ['A', 'B', 'D', 'F'].includes(e.name))
			.map(({ component: _c, ...info }) => createRegisterComponentMessage(info as never));
		expect(posted).toEqual(expected);
		posted.length = 0;
		ours.post_component_infos([], 'page');
		expect(posted).toEqual([]);
	});
});

describe('subscribe_to_editor (official subscribeToEditor)', () => {
	it('sets up editing, forwards content updates of the model, stops on the returned function', () => {
		const ours_cb = vi.fn();
		const stop = ours.subscribe_to_editor({ model: 'page', apiKey: 'k', callback: ours_cb });
		const ours_posts = posted.splice(0);
		send({ type: 'builder.contentUpdate', data: { modelName: 'page', data: { id: 'x' } } });
		send({ type: 'builder.contentUpdate', data: { modelName: 'footer', data: { id: 'y' } } });
		stop();
		send({ type: 'builder.contentUpdate', data: { modelName: 'page', data: { id: 'z' } } });
		expect(ours_cb.mock.calls).toEqual([[{ id: 'x' }, undefined]]);

		const official_cb = vi.fn();
		const stop2 = official.subscribeToEditor({ model: 'page', apiKey: 'k', callback: official_cb });
		expect(ours_posts).toEqual(posted.splice(0));
		send({ type: 'builder.contentUpdate', data: { modelName: 'page', data: { id: 'x' } } });
		send({ type: 'builder.contentUpdate', data: { modelName: 'footer', data: { id: 'y' } } });
		stop2();
		send({ type: 'builder.contentUpdate', data: { modelName: 'page', data: { id: 'z' } } });
		expect(ours_cb.mock.calls).toEqual(official_cb.mock.calls);
	});

	it('other editor messages reach no-ops (only content updates are forwarded, as the official)', () => {
		const cb = vi.fn();
		const stop = ours.subscribe_to_editor({ model: 'page', apiKey: 'k', callback: cb });
		send({ type: 'builder.configureSdk', data: { breakpoints: {} } });
		send({ type: 'builder.triggerAnimation', data: { elementId: 'x' } });
		send({ type: 'builder.resetState', data: { model: 'page', state: { a: 1 } } });
		stop();
		expect(cb).not.toHaveBeenCalled();
	});

	it('trusted hosts apply', () => {
		const cb = vi.fn();
		const stop = ours.subscribe_to_editor({ model: 'page', apiKey: 'k', callback: cb, trustedHosts: ['cms.me'] });
		send({ type: 'builder.contentUpdate', data: { modelName: 'page', data: { id: 'x' } } });
		send({ type: 'builder.contentUpdate', data: { modelName: 'page', data: { id: 'y' } } }, 'https://cms.me');
		stop();
		expect(cb.mock.calls).toEqual([[{ id: 'y' }, undefined]]);
	});
});
