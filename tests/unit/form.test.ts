// @vitest-environment happy-dom
// blocks/form.ts vs the official helpers it mirrors:
//   get_at          node_modules/@builder.io/sdk-svelte/src/functions/get.ts
//   set_at          node_modules/@builder.io/sdk-svelte/src/functions/set.ts
//   form_pairs      the inline `formPairs` in blocks/form/form/form.svelte (not exported: copied below)
//   email_submit_url the inline `formUrl` in blocks/form/form/form.svelte + functions/get-env.ts
//   log_fetch       functions/log-fetch.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { email_submit_url, form_pairs, get_at, log_fetch, set_at } from '../../src/lib/blocks/form';
import { get } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get';
import { set } from '../../node_modules/@builder.io/sdk-svelte/src/functions/set';
import { getEnv } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-env';
import { logFetch } from '../../node_modules/@builder.io/sdk-svelte/src/functions/log-fetch';

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Runs `fn`, returning its value or the thrown error's constructor name. */
function outcome<T>(fn: () => T): T | { threw: string } {
	try {
		return fn();
	} catch (e) {
		return { threw: (e as Error).constructor.name };
	}
}

const SAMPLE = () => ({
	a: { b: [{ c: 1 }, { c: 2, d: null }], e: 'str', z: 0, f: false, u: undefined },
	list: [10, 20, [30, 40]],
	'': 'empty-key',
	'x.y': 'dotted',
	n: null,
	nested: { deep: { deeper: { deepest: 'bottom' } } }
});

const GET_PATHS = [
	'',
	'a',
	'a.b',
	'a.b[0]',
	'a.b[0].c',
	'a.b.1.c',
	'a.b[1].d',
	'a.b[1].d.x',
	'a.b[5].c',
	'a.e',
	'a.e.length',
	'a.e.0',
	'a.z',
	'a.f',
	'a.u',
	'list[2][1]',
	'list.2.1',
	'list,2,0',
	'list[[2]]',
	'..a..b..',
	'x.y',
	'n',
	'n.x',
	'nested.deep.deeper.deepest',
	'missing',
	'missing.deeper',
	'[',
	']',
	'.',
	',',
	'__proto__',
	'constructor',
	'constructor.name',
	'a.__proto__.b',
	'toString',
	'ü.日本'
];

describe('get_at vs official get', () => {
	it('table over an object, with and without default', () => {
		for (const path of GET_PATHS) {
			expect(get_at(SAMPLE(), path), path).toEqual(get(SAMPLE(), path));
			expect(get_at(SAMPLE(), path, 'DEF'), path).toEqual(get(SAMPLE(), path, 'DEF'));
		}
	});

	it('root returned as is is treated as missing (result === obj)', () => {
		const obj = { a: 1 };
		expect(get_at(obj, '', 'd')).toBe('d');
		expect(get(obj, '', 'd')).toBe('d');
		expect(get_at(obj, '.', 'd')).toBe('d');
		const self: Record<string, unknown> = {};
		self.me = self;
		expect(get_at(self, 'me', 'd')).toBe(get(self, 'me', 'd')); // cycle back to root
		expect(get_at(self, 'me.me.me', 'd')).toBe('d');
	});

	it('primitive and nullish roots', () => {
		for (const root of [null, undefined, 0, 1, '', 'abc', true, NaN, [1, 2, 3], () => 1]) {
			for (const path of ['', 'a', '0', 'length', 'a.b', '1']) {
				expect(get_at(root, path, 'D')).toEqual(get(root, path, 'D'));
			}
		}
	});

	it('non-string path coerces like the official String.prototype.split.call', () => {
		expect(get_at({ 1: { 2: 'x' } }, 1.2 as unknown as string)).toBe(get({ 1: { 2: 'x' } }, 1.2 as unknown as string));
		expect(outcome(() => get_at({}, null as unknown as string))).toEqual(outcome(() => get({}, null as unknown as string)));
	});

	it('seeded sweep', () => {
		const rand = mulberry32(7);
		const segs = ['a', 'b', 'c', 'd', 'e', '0', '1', '2', 'list', 'n', 'x', 'y', 'nested', 'deep', '', '__proto__', 'constructor', 'length'];
		const seps = ['.', '[', ']', ',', '..', '[]', '].', ''];
		for (let i = 0; i < 500; i++) {
			let path = '';
			const n = Math.floor(rand() * 6);
			for (let j = 0; j < n; j++) path += segs[Math.floor(rand() * segs.length)] + seps[Math.floor(rand() * seps.length)];
			const def = rand() < 0.5 ? undefined : 'DEF';
			expect(get_at(SAMPLE(), path, def), path).toEqual(get(SAMPLE(), path, def));
		}
	});
});

const SET_PATHS = [
	'a',
	'a.b',
	'a.b.c',
	'a[0]',
	'a[0].b',
	'a.0.b',
	'list[1]',
	'list[5]',
	'list.-1.x',
	'list[1.5].x',
	'k[01].x',
	'k[1e1].x',
	'k[ 1].x',
	'k[-0].x',
	'k[4294967296].x',
	'str.x',
	'str.0',
	'num.x',
	'nul.x',
	'bool.x',
	'fn.x',
	'..a..b',
	'a[b][c]',
	'a,b',
	'a.b,c',
	'ü.日本',
	'deep.a.b.c.d.e.f.g.h.i.j',
	'x[0][0][0]'
];

const SHARED_FN = () => 1;
const SET_BASE = () => ({
	a: { b: 1 },
	list: [1, 2, 3],
	str: 'hello',
	num: 5,
	nul: null,
	bool: true,
	fn: SHARED_FN,
	arr: []
});

describe('set_at vs official set (compared on structured clones; official mutates)', () => {
	it('table', () => {
		const values = [1, 'v', null, undefined, { o: 1 }, [1], NaN];
		for (const path of SET_PATHS) {
			for (const v of values) {
				const ours = SET_BASE();
				const theirs = SET_BASE();
				set_at(ours, path, v);
				set(theirs, path, v);
				expect(ours, path).toEqual(theirs);
			}
		}
	});

	it('missing containers: arrays before an index, objects otherwise', () => {
		const ours: Record<string, unknown> = {};
		set_at(ours, 'a[0].b[1].c', 'x');
		expect(Array.isArray(ours.a)).toBe(true);
		expect(Array.isArray((ours.a as any)[0].b)).toBe(true);
		expect(ours).toEqual(set({}, 'a[0].b[1].c', 'x'));
	});

	it('empty path: ours is a no-op, the official throws (path.match returns null)', () => {
		const ours = { a: 1 };
		set_at(ours, '', 'x');
		set_at(ours, '...', 'x');
		set_at(ours, '[]', 'x');
		expect(ours).toEqual({ a: 1 });
		expect(outcome(() => set({ a: 1 }, '', 'x'))).toEqual({ threw: 'TypeError' });
	});

	it('form inputs keyed like form fields build the same JSON body', () => {
		const pairs = [
			['name', 'Al'],
			['address.street', 'Main'],
			['address.zip', 12345],
			['tags[0]', 'a'],
			['tags[1]', 'b'],
			['agree', true],
			['items[0].qty', 2],
			['items[0].sku', 'S1']
		] as const;
		const ours = {};
		const theirs = {};
		for (const [k, v] of pairs) {
			set_at(ours, k, v);
			set(theirs, k, v);
		}
		expect(JSON.stringify(ours)).toBe(JSON.stringify(theirs));
	});

	it('seeded sweep (sequences of sets on the same object)', () => {
		const rand = mulberry32(99);
		const segs = ['a', 'b', '0', '1', '2', 'list', 'str', 'num', 'nul', 'x', '-1', '1.5', '007', 'arr'];
		const seps = ['.', '[', ']', '].', '[]', ','];
		const values = [0, 1, 'v', null, true, { q: 1 }, [], NaN];
		for (let i = 0; i < 300; i++) {
			const ours = SET_BASE();
			const theirs = SET_BASE();
			const n = 1 + Math.floor(rand() * 4);
			for (let s = 0; s < n; s++) {
				let path = segs[Math.floor(rand() * segs.length)];
				const depth = Math.floor(rand() * 4);
				for (let j = 0; j < depth; j++) path += seps[Math.floor(rand() * seps.length)] + segs[Math.floor(rand() * segs.length)];
				const v = values[Math.floor(rand() * values.length)];
				const a = outcome(() => set_at(ours, path, v));
				const b = outcome(() => set(theirs, path, v));
				expect(a === undefined ? undefined : a, path).toEqual(b === theirs ? undefined : b);
				expect(ours, path).toEqual(theirs);
			}
		}
	});

	it('the parsed path cache does not leak between calls (same path, different objects)', () => {
		const a = {};
		const b = { p: { q: 1 } };
		set_at(a, 'p.q', 2);
		set_at(b, 'p.q', 3);
		expect(a).toEqual({ p: { q: 2 } });
		expect(b).toEqual({ p: { q: 3 } });
	});

	it('__proto__ / constructor keys: same result as the official on the target object', () => {
		const cleanup = () => {
			delete (Object.prototype as any).polluted;
			delete (Object.prototype as any).polluted2;
		};
		try {
			const ours: Record<string, unknown> = {};
			const theirs: Record<string, unknown> = {};
			set_at(ours, 'safe.__proto__x', 1);
			set(theirs, 'safe.__proto__x', 1);
			expect(ours).toEqual(theirs);
		} finally {
			cleanup();
		}
	});

	// Regression (an official `set` bug, functions/set.ts, deliberately not copied): a form field named
	// `__proto__.x` or `constructor.prototype.x` walked into Object.prototype and wrote there when a form
	// is sent as application/json. Field names come from content. set_at walks own containers only.
	it('does not pollute Object.prototype through __proto__ / constructor.prototype paths', () => {
		try {
			set_at({}, '__proto__.polluted', 'yes');
			set_at({}, 'constructor.prototype.polluted2', 'yes');
			set_at({}, 'constructor.polluted3', 'yes');
			expect(({} as any).polluted).toBeUndefined();
			expect(({} as any).polluted2).toBeUndefined();
			expect((Object as any).polluted3).toBeUndefined();
			// (an own `constructor` / `__proto__`-named field still lands in the body object)
			const body: Record<string, unknown> = {};
			set_at(body, 'constructor.name', 'x');
			expect(body).toEqual({ constructor: { name: 'x' } });
		} finally {
			delete (Object.prototype as any).polluted;
			delete (Object.prototype as any).polluted2;
			delete (Object as any).polluted3;
		}
	});

	it('official set pollutes the same way (parity note)', () => {
		try {
			set({}, '__proto__.polluted', 'yes');
			expect(({} as any).polluted).toBe('yes');
		} finally {
			delete (Object.prototype as any).polluted;
		}
	});
});

/** Copied from node_modules/@builder.io/sdk-svelte/src/blocks/form/form/form.svelte (onSubmit, `formPairs`). */
function official_form_pairs(el: HTMLElement) {
	return Array.from(el.querySelectorAll('input,select,textarea'))
		.filter((el) => !!(el as HTMLInputElement).name)
		.filter((el) => !!(el as HTMLInputElement).name && ((el as HTMLInputElement).type !== 'radio' || (el as HTMLInputElement).checked))
		.map((el) => {
			let value: any;
			const key = (el as HTMLImageElement).name;
			if (el instanceof HTMLInputElement) {
				if (el.type === 'radio') {
					if (el.checked) {
						value = el.value;
						return { key, value };
					}
				} else if (el.type === 'checkbox') {
					value = el.checked;
				} else if (el.type === 'number' || el.type === 'range') {
					const num = el.valueAsNumber;
					if (!isNaN(num)) {
						value = num;
					}
				} else if (el.type === 'file') {
					value = el.files;
				} else {
					value = el.value;
				}
			} else {
				value = (el as HTMLInputElement).value;
			}
			return { key, value };
		});
}

const form_of = (html: string) => {
	const form = document.createElement('form');
	form.innerHTML = html;
	return form;
};

const FORMS = [
	'',
	'<input name="a" value="1">',
	'<input value="unnamed"><input name="" value="empty-name"><textarea>no name</textarea>',
	'<input type="radio" name="r" value="x"><input type="radio" name="r" value="y" checked><input type="radio" name="r" value="z">',
	'<input type="radio" name="r" value="x"><input type="radio" name="r" value="y">',
	'<input type="checkbox" name="c1" checked><input type="checkbox" name="c2"><input type="checkbox" name="c3" value="v" checked>',
	'<input type="number" name="n" value="42"><input type="number" name="nf" value="3.5"><input type="number" name="nan" value="abc"><input type="number" name="empty">',
	'<input type="range" name="rg" value="7"><input type="range" name="rg0">',
	'<input type="file" name="f">',
	'<input type="text" name="t" value="hi"><input type="email" name="e" value="a@b.c"><input type="hidden" name="h" value="secret"><input type="password" name="p" value="pw">',
	'<select name="s"><option value="a">A</option><option value="b" selected>B</option></select><select name="s2"></select>',
	'<textarea name="ta">multi\nline</textarea>',
	'<input name="dup" value="1"><input name="dup" value="2">',
	'<input name="user.name" value="Al"><input name="tags[0]" value="x"><input name="__proto__.p" value="v">',
	'<fieldset><div><input name="nested" value="deep"></div></fieldset><button name="btn" value="ignored">B</button>',
	'<input name="ü" value="日本語 😀">'
];

describe('form_pairs vs the official formPairs (form.svelte)', () => {
	it('table of forms', () => {
		for (const html of FORMS) expect(form_pairs(form_of(html)), html).toEqual(official_form_pairs(form_of(html)));
	});

	it('typed values', () => {
		const pairs = form_pairs(
			form_of(
				'<input type="checkbox" name="c" checked><input type="number" name="n" value="5"><input type="number" name="bad" value="x"><input type="radio" name="r" value="y" checked><input name="t" value="v">'
			)
		);
		expect(pairs).toEqual([
			{ key: 'c', value: true },
			{ key: 'n', value: 5 },
			{ key: 'bad', value: undefined }, // NaN numbers: key kept, value undefined (as the official)
			{ key: 'r', value: 'y' },
			{ key: 't', value: 'v' }
		]);
	});

	it('file input gives its FileList', () => {
		const form = form_of('<input type="file" name="f">');
		const [pair] = form_pairs(form);
		expect(pair.key).toBe('f');
		expect(pair.value).toBe((form.querySelector('input') as HTMLInputElement).files);
	});

	it('file input with files === null: ours undefined, official null (both drop out of JSON)', () => {
		const form = form_of('<input type="file" name="f">');
		Object.defineProperty(form.querySelector('input')!, 'files', { value: null });
		expect(form_pairs(form)).toEqual([{ key: 'f', value: undefined }]);
		expect(official_form_pairs(form)).toEqual([{ key: 'f', value: null }]);
		expect(JSON.stringify({ f: undefined })).toBe(JSON.stringify({}));
	});

	it('values changed after parse (live .value / .checked) are read', () => {
		const form = form_of('<input name="t" value="a"><input type="checkbox" name="c"><input type="radio" name="r" value="1">');
		const [t, c, r] = Array.from(form.querySelectorAll('input'));
		t.value = 'changed';
		c.checked = true;
		r.checked = true;
		expect(form_pairs(form)).toEqual(official_form_pairs(form));
		expect(form_pairs(form)).toEqual([
			{ key: 't', value: 'changed' },
			{ key: 'c', value: true },
			{ key: 'r', value: '1' }
		]);
	});

	it('seeded sweep of generated forms', () => {
		const rand = mulberry32(2024);
		const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
		const types = ['text', 'radio', 'checkbox', 'number', 'range', 'file', 'email', 'hidden', 'date', 'bogus'];
		const names = ['a', 'b', '', 'a.b', 'x[0]', 'r'];
		const values = ['', '1', '2.5', 'abc', '-3', 'ü', 'NaN', 'Infinity', '1e3'];
		for (let i = 0; i < 200; i++) {
			let html = '';
			const n = Math.floor(rand() * 6);
			for (let j = 0; j < n; j++) {
				const kind = rand();
				const name = pick(names);
				const name_attr = rand() < 0.1 ? '' : ` name="${name}"`;
				if (kind < 0.7)
					html += `<input type="${pick(types)}"${name_attr} value="${pick(values)}"${rand() < 0.5 ? ' checked' : ''}>`;
				else if (kind < 0.85) html += `<select${name_attr}><option value="${pick(values)}">o</option></select>`;
				else html += `<textarea${name_attr}>${pick(values)}</textarea>`;
			}
			expect(form_pairs(form_of(html)), html).toEqual(official_form_pairs(form_of(html)));
		}
	});
});

/** Copied from form.svelte (`formUrl`), with the official getEnv. */
const official_form_url = (apiKey: unknown, sendSubmissionsToEmail: string | undefined, name: string | undefined) =>
	`${getEnv() === 'dev' ? 'http://localhost:5000' : 'https://builder.io'}/api/v1/form-submit?apiKey=${apiKey}&to=${btoa(
		sendSubmissionsToEmail || ''
	)}&name=${encodeURIComponent(name || '')}`;

describe('email_submit_url vs the official formUrl', () => {
	afterEach(() => {
		vi.unstubAllGlobals(); // (restore process first: unstubAllEnvs needs it)
		vi.unstubAllEnvs();
	});

	const CASES: Array<[unknown, string | undefined, string | undefined]> = [
		['key', 'a@b.com', 'My Form'],
		['key', undefined, undefined],
		['key', '', ''],
		[undefined, 'x@y.z', 'a&b=c?d/e'],
		[null, 'x@y.z', 'ü 日本 😀'],
		[123, 'a+b@c.com', '%20'],
		['k&x=y', 'a@b', 'n']
	];

	for (const env of ['dev', 'production', 'development', 'test', 'qa', 'nonsense', '']) {
		it(`NODE_ENV=${JSON.stringify(env)}`, () => {
			vi.stubEnv('NODE_ENV', env);
			for (const [k, e, n] of CASES) expect(email_submit_url(k, e, n)).toBe(official_form_url(k, e, n));
			expect(email_submit_url('k', 'a', 'b').startsWith(env === 'dev' ? 'http://localhost:5000/' : 'https://builder.io/')).toBe(true);
		});
	}

	it('NODE_ENV unset -> production host', () => {
		vi.stubEnv('NODE_ENV', undefined as unknown as string);
		expect(email_submit_url('k', 'a@b', 'n')).toBe(official_form_url('k', 'a@b', 'n'));
		expect(email_submit_url('k', 'a@b', 'n')).toBe(`https://builder.io/api/v1/form-submit?apiKey=k&to=${btoa('a@b')}&name=n`);
	});

	it('no process global -> production host (the official getEnv would throw here)', () => {
		vi.stubGlobal('process', undefined);
		expect(email_submit_url('k', 'a@b', 'n')).toBe(`https://builder.io/api/v1/form-submit?apiKey=k&to=${btoa('a@b')}&name=n`);
	});

	it('non-Latin1 email: btoa throws in both (same failure as the official)', () => {
		const ours = outcome(() => email_submit_url('k', 'ü日本@x.com', 'n'));
		const theirs = outcome(() => official_form_url('k', 'ü日本@x.com', 'n'));
		expect(ours).toEqual(theirs);
		expect((ours as { threw: string }).threw).toBeTruthy();
		// Latin-1 (ü is U+00FC) is fine in both
		expect(email_submit_url('k', 'ü@x.com', 'n')).toBe(official_form_url('k', 'ü@x.com', 'n'));
	});
});

describe('log_fetch vs official logFetch', () => {
	afterEach(() => {
		vi.unstubAllGlobals(); // (restore process first: unstubAllEnvs needs it)
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	for (const debug of ['true', 'TRUE', '1', 'false', '', 'yes', undefined]) {
		it(`DEBUG=${JSON.stringify(debug)}`, () => {
			vi.stubEnv('DEBUG', debug as string);
			const log = vi.spyOn(console, 'log').mockImplementation(() => {});
			log_fetch('https://cdn.builder.io/api/v3/content/page');
			const ours = log.mock.calls.slice();
			log.mockClear();
			logFetch('https://cdn.builder.io/api/v3/content/page');
			expect(ours).toEqual(log.mock.calls);
			expect(ours.length).toBe(debug === 'true' ? 1 : 0);
		});
	}

	it('logs the url with the official prefix', () => {
		vi.stubEnv('DEBUG', 'true');
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		log_fetch('u');
		expect(log).toHaveBeenCalledWith('[Builder.io]: ', 'u');
	});

	it('no process global: no-op, no throw', () => {
		vi.stubGlobal('process', undefined);
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		log_fetch('u');
		expect(log).not.toHaveBeenCalled();
	});
});
