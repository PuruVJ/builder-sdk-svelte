// src/lib/index.ts on the server: every public function, against the official exports.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as sdk from '../../src/lib/index.js';
import { fetchBuilderProps } from '../../node_modules/@builder.io/sdk-svelte/src/functions/fetch-builder-props';
import { _processContentResult } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-content/index';
import { getBuilderSearchParams } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-builder-search-params/index';
import { register, register_action, set_editor_settings, create_register_component_message } from '../../src/lib/internal/editor.js';
import { is_editing, is_previewing } from '../../src/lib/internal/env.js';
import { set_user_attributes } from '../../src/lib/internal/user-attributes.js';

afterEach(() => vi.restoreAllMocks());

const fake = (body: unknown = { results: [{ id: 'c', data: { title: 't' } }] }) =>
	vi.fn(async (_url: string, _init?: RequestInit) => ({ json: async () => structuredClone(body) }) as unknown as Response);

describe('public API', () => {
	it('exports the official names', () => {
		for (const name of [
			'Content', 'Blocks', 'Button', 'Columns', 'Fragment', 'Image', 'Section', 'Symbol', 'Text', 'Video', 'BuilderContext',
			'isEditing', 'isPreviewing', 'setClientUserAttributes', 'getBuilderSearchParams', 'track', 'fetchEntries', 'fetchOneEntry',
			'_processContentResult', 'fetchBuilderProps', 'register', 'registerAction', 'setEditorSettings', 'createRegisterComponentMessage',
			'subscribeToEditor'
		])
			expect(sdk, name).toHaveProperty(name);
	});

	it('the thin aliases are the internal functions', () => {
		expect(sdk.isEditing).toBe(is_editing);
		expect(sdk.isPreviewing).toBe(is_previewing);
		expect(sdk.setClientUserAttributes).toBe(set_user_attributes);
		expect(sdk.register).toBe(register);
		expect(sdk.registerAction).toBe(register_action);
		expect(sdk.setEditorSettings).toBe(set_editor_settings);
		expect(sdk.createRegisterComponentMessage).toBe(create_register_component_message);
	});

	it('getBuilderSearchParams (official)', () => {
		const input = { 'builder.preview': 'page', 'builder.options.locale': 'de', x: '1' };
		expect(sdk.getBuilderSearchParams(input)).toEqual(getBuilderSearchParams(input));
		expect(sdk.getBuilderSearchParams(undefined)).toEqual({});
	});

	it('isPreviewing / isEditing on the server read the given search only', () => {
		expect(sdk.isPreviewing()).toBe(false);
		expect(sdk.isPreviewing('?builder.preview=page')).toBe(true);
		expect(sdk.isEditing('?builder.frameEditing=page')).toBe(false);
	});

	it('track on the server: sends nothing', async () => {
		const f = vi.fn();
		vi.stubGlobal('fetch', f);
		try {
			await sdk.track({ type: 'impression', apiKey: 'k' });
			expect(f).not.toHaveBeenCalled();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('fetchEntries / fetchOneEntry', async () => {
		const f = fake({ results: [{ id: 'a' }, { id: 'b' }] });
		expect(await sdk.fetchEntries({ model: 'page', apiKey: 'k', fetch: f } as never)).toEqual([{ id: 'a' }, { id: 'b' }]);
		expect(await sdk.fetchOneEntry({ model: 'page', apiKey: 'k', fetch: f } as never)).toEqual({ id: 'a' });
		expect(f.mock.calls[1][0]).toContain('limit=1');
	});

	it('_processContentResult on the server: the results as they are (official)', async () => {
		const content = { results: [{ id: 'c', variations: { v: { id: 'v', testRatio: 1 } } }] };
		const opts = { model: 'page', apiKey: 'k' };
		expect(await sdk._processContentResult(opts as never, structuredClone(content) as never)).toEqual(
			await _processContentResult(opts as never, structuredClone(content) as never)
		);
	});

	describe('fetchBuilderProps (official fetchBuilderProps)', () => {
		const cases: Record<string, unknown>[] = [
			{ apiKey: 'k' },
			{ apiKey: 'k', model: 'section' },
			{ apiKey: 'k', path: '/about' },
			{ apiKey: 'k', path: '/x', searchParams: new URLSearchParams('builder.preview=page&builder.options.locale=de&q=1') },
			{ apiKey: 'k', path: '/x', searchParams: { 'builder.cachebust': 'true' } },
			{ apiKey: 'k', url: new URL('https://site.com/shop/item?builder.preview=page&a=b') },
			{ apiKey: 'k', userAttributes: { urlPath: '/from-attrs', device: 'mobile' } },
			{ apiKey: 'k', path: '/p', userAttributes: { urlPath: '/ignored', locale: 'fr' } },
			{ apiKey: 'k', options: { 'builder.x': 1, y: 2 } },
			{ apiKey: 'k', locale: 'de', path: '' }
		];
		for (const [i, args] of cases.entries())
			it(`#${i}`, async () => {
				const f1 = fake();
				const f2 = fake();
				const ours = await sdk.fetchBuilderProps({ ...args, fetch: f1 } as never);
				const official = await fetchBuilderProps({ ...args, fetch: f2 } as never);
				expect(ours).toEqual(official);
				expect(f1.mock.calls).toEqual(f2.mock.calls);
			});
	});

	it('subscribeToEditor on the server: warns, returns a no-op', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const stop = sdk.subscribeToEditor({ model: 'page', apiKey: 'k', callback: () => {} });
		expect(warn).toHaveBeenCalledOnce();
		expect(() => stop()).not.toThrow();
	});
});
