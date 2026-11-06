// internal/registry.ts: one registry per custom-component list, custom over default, model filtering.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REGISTRY_BRAND, is_restricted, lookup, registry_for } from '../../src/lib/internal/registry.js';
import { default_components } from '../../src/lib/internal/defaults.js';
import type { RegisteredComponent } from '../../src/lib/types.js';

const C = (name: string, extra: Partial<RegisteredComponent> = {}): RegisteredComponent => ({ name, component: () => null, ...extra });

afterEach(() => vi.restoreAllMocks());

describe('registry_for', () => {
	it('undefined and null give one shared empty registry with the defaults', () => {
		const a = registry_for(undefined);
		const b = registry_for(null);
		expect(a).toBe(b);
		expect(a[REGISTRY_BRAND]).toBe(true);
		expect([...a.by_name.keys()]).toEqual(default_components().map((c) => c.name));
		expect(a.by_name.get('Text')).toBe(default_components().find((c) => c.name === 'Text'));
	});

	it('an empty list is its own registry (not the null one) with the defaults', () => {
		const list: RegisteredComponent[] = [];
		const r = registry_for(list);
		expect(r).not.toBe(registry_for(undefined));
		expect(r.by_name.size).toBe(default_components().length);
	});

	it('caches by list identity', () => {
		const list = [C('A')];
		expect(registry_for(list)).toBe(registry_for(list));
		expect(registry_for([...list])).not.toBe(registry_for(list));
	});

	it('custom wins over default by name, keeping the default position', () => {
		const text = C('Text');
		const r = registry_for([text, C('Extra')]);
		expect(r.by_name.get('Text')).toBe(text);
		const names = [...r.by_name.keys()];
		expect(names.indexOf('Text')).toBe(default_components().findIndex((c) => c.name === 'Text'));
		expect(names.at(-1)).toBe('Extra');
	});

	it('the last custom entry with a name wins', () => {
		const a1 = C('A');
		const a2 = C('A', { noWrap: true });
		expect(registry_for([a1, a2]).by_name.get('A')).toBe(a2);
	});

	it('ignores entries without a name (and null holes)', () => {
		const list = [C(''), { component: 1 } as unknown as RegisteredComponent, null as unknown as RegisteredComponent, C('Ok')];
		const r = registry_for(list);
		expect(r.by_name.has('')).toBe(false);
		expect(r.by_name.has('Ok')).toBe(true);
		expect(r.by_name.size).toBe(default_components().length + 1);
	});

	it('a Registry passes through', () => {
		const r = registry_for([C('X')]);
		expect(registry_for(r)).toBe(r);
	});

	it('the object form from as_object maps back to its registry', () => {
		const r = registry_for([C('X')]);
		const obj = r.as_object('page');
		expect(registry_for(obj)).toBe(r);
		// the back-link is invisible: not enumerable, not a key
		expect(Object.keys(obj)).not.toContain('puruvj.builder.registry-of');
		expect(JSON.stringify(Object.keys(obj))).toBe(JSON.stringify([...r.by_name.keys()]));
	});

	it('a hand-built object form is the exact set (no defaults added), cached by object', () => {
		const obj = { Foo: C('Foo'), Bar: C('Bar') };
		const r = registry_for(obj);
		expect([...r.by_name.keys()]).toEqual(['Foo', 'Bar']);
		expect(registry_for(obj)).toBe(r);
	});

	it('an object keyed differently from the names registers by name', () => {
		const r = registry_for({ k: C('Real') });
		expect([...r.by_name.keys()]).toEqual(['Real']);
	});
});

describe('as_object', () => {
	it('filters by model and caches per model', () => {
		const only_page = C('OnlyPage', { models: ['page'] });
		const any = C('Any', { models: [] });
		const r = registry_for([only_page, any]);
		const page = r.as_object('page');
		const sec = r.as_object('section');
		expect(page.OnlyPage).toBe(only_page);
		expect(page.Any).toBe(any);
		expect(sec.OnlyPage).toBeUndefined();
		expect(sec.Any).toBe(any);
		expect(r.as_object('page')).toBe(page);
		expect(r.as_object('section')).toBe(sec);
		expect(page).not.toBe(sec);
	});

	it('empty model filters nothing', () => {
		const r = registry_for([C('M', { models: ['x'] })]);
		expect(r.as_object('').M).toBeDefined();
	});

	it('both model objects map back to the same registry', () => {
		const r = registry_for([C('M', { models: ['x'] })]);
		expect(registry_for(r.as_object('x'))).toBe(r);
		expect(registry_for(r.as_object('y'))).toBe(r);
	});
});

describe('is_restricted (official checkIsComponentRestricted)', () => {
	const cases: Array<[RegisteredComponent | undefined, string | undefined, boolean]> = [
		[undefined, 'page', true],
		[undefined, undefined, true],
		[C('a'), undefined, false],
		[C('a'), '', false],
		[C('a', { models: ['page'] }), undefined, false],
		[C('a'), 'page', false],
		[C('a', { models: [] }), 'page', false],
		[C('a', { models: ['page'] }), 'page', false],
		[C('a', { models: ['page', 'section'] }), 'section', false],
		[C('a', { models: ['page'] }), 'section', true],
		[C('a', { models: ['Page'] }), 'page', true]
	];
	it.each(cases)('%#', (entry, model, want) => {
		expect(is_restricted(entry, model)).toBe(want);
	});
});

describe('lookup', () => {
	it('finds a registered component', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const a = C('LookA');
		const r = registry_for([a]);
		expect(lookup(r, 'LookA', 'page')).toBe(a);
		expect(lookup(r, 'LookA', undefined)).toBe(a);
		expect(warn).not.toHaveBeenCalled();
	});

	it('warns once per missing name, returns undefined each time', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const r = registry_for([]);
		expect(lookup(r, 'Missing-1', 'page')).toBeUndefined();
		expect(lookup(r, 'Missing-1', 'page')).toBeUndefined();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toContain('Could not find a registered component named "Missing-1"');
		expect(lookup(r, 'Missing-2', 'page')).toBeUndefined();
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it('a component restricted to another model is not found (and warns once)', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const r = registry_for([C('Restricted-1', { models: ['page'] })]);
		expect(lookup(r, 'Restricted-1', 'section')).toBeUndefined();
		expect(lookup(r, 'Restricted-1', 'section')).toBeUndefined();
		expect(warn).toHaveBeenCalledTimes(1);
		// once warned, a model that may see it still finds it
		expect(lookup(r, 'Restricted-1', 'page')).toBeDefined();
	});

	it('prototype keys are not components', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const r = registry_for([]);
		expect(lookup(r, '__proto__', 'page')).toBeUndefined();
		expect(lookup(r, 'constructor', 'page')).toBeUndefined();
		expect(lookup(r, 'toString', 'page')).toBeUndefined();
	});
});
