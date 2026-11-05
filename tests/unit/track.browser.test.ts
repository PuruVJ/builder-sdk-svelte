// @vitest-environment happy-dom
// internal/track.ts in the browser against the official functions/track (+ helpers/cookie,
// sessionId, visitorId): the exact POST, the cookies it writes, the click-interaction metadata.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get_cookie, get_user_attributes, interaction_properties, sdk_headers, set_cookie, track } from '../../src/lib/internal/track.js';
import { _track } from '../../node_modules/@builder.io/sdk-svelte/src/functions/track/index';
import { getUserAttributes } from '../../node_modules/@builder.io/sdk-svelte/src/functions/track/helpers';
import { getInteractionPropertiesForEvent } from '../../node_modules/@builder.io/sdk-svelte/src/functions/track/interaction';
import { getCookieSync, setCookie } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/cookie';
import { getSdkHeaders } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/sdk-headers';
import { clear_cookies, in_iframe, install_local_storage, set_url, type MemoryStorage } from './_dom.js';

let storage: MemoryStorage;

/** Every string written to document.cookie while `fn` runs (the real cookie jar still gets it). */
async function cookie_writes(fn: () => unknown): Promise<string[]> {
	const proto = Object.getPrototypeOf(document);
	let owner = proto;
	while (owner && !Object.getOwnPropertyDescriptor(owner, 'cookie')) owner = Object.getPrototypeOf(owner);
	const desc = Object.getOwnPropertyDescriptor(owner, 'cookie')!;
	const writes: string[] = [];
	Object.defineProperty(document, 'cookie', {
		configurable: true,
		get: () => desc.get!.call(document),
		set: (v: string) => {
			writes.push(v);
			desc.set!.call(document, v);
		}
	});
	try {
		await fn();
	} finally {
		delete (document as { cookie?: string }).cookie;
	}
	return writes;
}

let fetch_spy: ReturnType<typeof vi.fn>;
beforeEach(() => {
	set_url('/page?x=1');
	clear_cookies();
	storage = install_local_storage();
	fetch_spy = vi.fn(async () => new Response('{}'));
	vi.stubGlobal('fetch', fetch_spy);
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('track (official _track)', () => {
	const events: Record<string, unknown>[] = [
		{ type: 'impression', apiKey: 'k', canTrack: true, contentId: 'c1' },
		{ type: 'conversion', apiKey: 'k', canTrack: true, contentId: 'c1', variationId: 'v1', metadata: { amount: 5, url: 'override' } },
		{ type: 'click', apiKey: 'k', canTrack: true, targetBuilderElement: 'builder-1', metadata: { targetOffset: { x: 0.5, y: 1 } } },
		{ type: 'impression', apiKey: 'k', canTrack: true, apiHost: 'http://localhost:4000', unicode: '✓ü', nested: { a: [1] } },
		{ type: 'x', apiKey: 'k', canTrack: true, metadata: undefined, contentId: undefined }
	];

	it.each(events.map((e, i) => [i, e]))('the same POST as the official, ids reused (#%i)', async (_i, event) => {
		document.cookie = 'builderSessionId=sess123; path=/';
		localStorage.setItem('builderVisitorId', 'vis456');
		await track(structuredClone(event) as never);
		await _track(structuredClone(event) as never);
		expect(fetch_spy).toHaveBeenCalledTimes(2);
		const [ours, official] = fetch_spy.mock.calls;
		expect(ours).toEqual(official);
		// (byte-identical body: key order included)
		expect((ours[1] as RequestInit).body).toBe((official[1] as RequestInit).body);
		const body = JSON.parse((ours[1] as RequestInit).body as string);
		expect(body.events[0].data.sessionId).toBe('sess123');
		expect(body.events[0].data.visitorId).toBe('vis456');
	});

	it('creates a session cookie and a visitor id the official way (32 hex, v4) and reuses them', async () => {
		const writes = await cookie_writes(() => track({ type: 'impression', apiKey: 'k', canTrack: true }));
		const body = JSON.parse(fetch_spy.mock.calls[0][1].body);
		const { sessionId, visitorId } = body.events[0].data;
		for (const id of [sessionId, visitorId]) expect(id).toMatch(/^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/);
		expect(localStorage.getItem('builderVisitorId')).toBe(visitorId);
		expect(get_cookie('builderSessionId', true)).toBe(sessionId);
		// the cookie string is the official one for the same value
		const official_writes = await cookie_writes(() => setCookie({ name: 'builderSessionId', value: sessionId, canTrack: true }));
		expect(writes).toEqual(official_writes);
		await track({ type: 'impression', apiKey: 'k', canTrack: true });
		expect(JSON.parse(fetch_spy.mock.calls[1][1].body).events[0].data).toMatchObject({ sessionId, visitorId });
	});

	it('ids without crypto.randomUUID (the Math.random template)', async () => {
		vi.stubGlobal('crypto', {});
		await track({ type: 'impression', apiKey: 'k', canTrack: true });
		const { sessionId, visitorId } = JSON.parse(fetch_spy.mock.calls[0][1].body).events[0].data;
		for (const id of [sessionId, visitorId]) expect(id).toMatch(/^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/);
	});

	it('no API key: logs and sends nothing', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		await track({ type: 'impression', apiKey: '', canTrack: true });
		expect(fetch_spy).not.toHaveBeenCalled();
		expect(err.mock.calls[0][0]).toBe('[Builder.io]: Missing API key for track call. Please provide your API key.');
	});

	it('canTrack false / undefined: nothing sent, no ids created', async () => {
		await track({ type: 'impression', apiKey: 'k', canTrack: false });
		await track({ type: 'impression', apiKey: 'k' });
		expect(fetch_spy).not.toHaveBeenCalled();
		expect(document.cookie).toBe('');
		expect(localStorage.length).toBe(0);
	});

	it('inside the editor (iframe + builder.frameEditing): nothing sent, as the official', async () => {
		set_url('/page?builder.frameEditing=page');
		await in_iframe(async () => {
			await track({ type: 'impression', apiKey: 'k', canTrack: true });
			await _track({ type: 'impression', apiKey: 'k', canTrack: true } as never);
		});
		expect(fetch_spy).not.toHaveBeenCalled();
	});

	it('a failing fetch is logged, never thrown', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		fetch_spy.mockRejectedValueOnce(new Error('offline'));
		await expect(track({ type: 'impression', apiKey: 'k', canTrack: true })).resolves.toBeUndefined();
		expect(err).toHaveBeenCalledWith('Failed to track: ', expect.any(Error));
	});

	it('localStorage that throws: no visitor id, the event still goes', async () => {
		vi.spyOn(storage, 'getItem').mockImplementation(() => {
			throw new Error('denied');
		});
		await track({ type: 'impression', apiKey: 'k', canTrack: true });
		const data = JSON.parse(fetch_spy.mock.calls[0][1].body).events[0].data;
		expect(data.visitorId).toBeUndefined();
		expect(data.sessionId).toMatch(/^[0-9a-f]{32}$/);
	});

	it('sdk_headers are the official ones', () => {
		expect(sdk_headers()).toEqual(getSdkHeaders());
	});
});

describe('cookies (official helpers/cookie)', () => {
	const cases: Array<[string, string, Date | undefined]> = [
		['a', '1', undefined],
		['builder.tests.c1', 'v1', new Date(Date.UTC(2030, 0, 1))],
		['x', '{"json":true}', undefined],
		['ü', '✓', undefined]
	];
	for (const host of ['http://localhost/', 'https://www.example.co.uk/p', 'https://example.com/', 'http://127.0.0.1:3000/', 'https://a.b.c.d.example.org/'])
		it(`set_cookie writes the official string on ${host}`, async () => {
			// (happy-dom: the URL decides location.protocol / hostname)
			(window as unknown as { happyDOM: { setURL(u: string): void } }).happyDOM.setURL(host);
			for (const [name, value, expires] of cases) {
				const ours = await cookie_writes(() => set_cookie(name, value, true, expires));
				const official = await cookie_writes(() => setCookie({ name, value, expires, canTrack: true }));
				expect(ours).toEqual(official);
			}
		});

	it('get_cookie reads as getCookieSync does', () => {
		document.cookie = 'a=1; path=/';
		document.cookie = 'ab=2; path=/';
		document.cookie = 'json={"x":1}; path=/';
		for (const name of ['a', 'ab', 'b', 'json', ''])
			for (const can of [true, false]) expect(get_cookie(name, can)).toBe(getCookieSync({ name, canTrack: can }));
	});

	it('canTrack false: nothing written', async () => {
		expect(await cookie_writes(() => set_cookie('a', '1', false))).toEqual([]);
	});

	it('a document.cookie that throws: get is undefined, set is silent', () => {
		Object.defineProperty(document, 'cookie', {
			configurable: true,
			get: () => {
				throw new Error('no');
			},
			set: () => {
				throw new Error('no');
			}
		});
		try {
			expect(get_cookie('a', true)).toBeUndefined();
			expect(() => set_cookie('a', '1', true)).not.toThrow();
		} finally {
			delete (document as { cookie?: string }).cookie;
		}
	});
});

describe('get_user_attributes (official getUserAttributes)', () => {
	const agents = [
		'',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
		'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
		'Mozilla/5.0 (Linux; Android 14) Mobile',
		'Mozilla/5.0 (Linux; Android 14; Tablet)',
		'BlackBerry9700',
		'Opera Mini/9',
		'IEMobile/11',
		'WPDesktop',
		'ipod touch'
	];
	for (const ua of agents)
		it(`UA "${ua.slice(0, 40)}"`, () => {
			vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
			set_url('/some/path?q=1#h');
			expect(get_user_attributes()).toEqual(getUserAttributes());
		});
});

describe('interaction_properties (official getInteractionPropertiesForEvent)', () => {
	function rect(el: Element, r: { left: number; top: number; width: number; height: number }) {
		el.getBoundingClientRect = () => ({ ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() {} }) as DOMRect;
	}
	function page() {
		document.body.innerHTML = `
			<div builder-id="builder-a" class="builder-a builder-block"><span id="inner"><b id="deep">x</b></span></div>
			<div builder-id="builder-a" class="builder-a builder-block" id="second"><i id="in-second">y</i></div>
			<div id="builder-by-id"><em id="em">z</em></div>
			<div id="outside"><svg id="svg"><circle id="circle"></circle></svg></div>`;
		const els = document.querySelectorAll('*');
		let n = 0;
		for (const el of els) rect(el, { left: 10 * n, top: 5 * n, width: 100 + n, height: 0 === n ? 0 : 33 + n++ });
	}
	const event = (target: EventTarget | null, x: number, y: number) => ({ target, clientX: x, clientY: y }) as unknown as MouseEvent;

	for (const id of ['deep', 'inner', 'in-second', 'em', 'outside', 'svg', 'circle'])
		it(`a click on #${id}`, () => {
			page();
			const e = event(document.getElementById(id), 57.123456, 21.987654);
			expect(interaction_properties(e)).toEqual(getInteractionPropertiesForEvent(e));
		});

	it('a null target', () => {
		page();
		const e = event(null, 1, 1);
		expect(interaction_properties(e)).toEqual(getInteractionPropertiesForEvent(e));
	});

	it('a zero-size element gives the official NaN / Infinity ratios', () => {
		document.body.innerHTML = '<div builder-id="builder-z" class="builder-z" id="z"></div>';
		const el = document.getElementById('z')!;
		rect(el, { left: 0, top: 0, width: 0, height: 0 });
		for (const [x, y] of [[0, 0], [5, 5]]) {
			const e = event(el, x, y);
			expect(interaction_properties(e)).toEqual(getInteractionPropertiesForEvent(e));
		}
	});
});
