/**
 * The SSR bench/test entry: both SDKs, one Svelte runtime, built once by Vite for Node
 * (bench/vite.ssr.config.ts) so every measurement runs the production server code of each.
 */
import { render } from 'svelte/server';
import { Content as OfficialContent, Blocks as OfficialBlocks } from '@builder.io/sdk-svelte';
import { Content as OursContent, Blocks as OursBlocks } from '../src/lib/index.js';
import StubOfficial from './stubs/StubOfficial.svelte';
import StubOurs from './stubs/StubOurs.svelte';
import { current } from './app/sdk.js';
import { PLAIN } from '../src/lib/internal/plain.js';
import Page from './app/Page.svelte';
import Leaf from './app/Leaf.svelte';
import NoWrap from './app/NoWrap.svelte';
import ChildrenOption from './app/ChildrenOption.svelte';
import ContextReader from './app/ContextReader.svelte';

export type Sdk = 'official' | 'ours';

const ALL_PROPS = { builderBlock: true, builderContext: true, builderComponents: true, builderLinkComponent: true };
const BUILT_IN = new Set([
	'Core:Button', 'Columns', 'Fragment', 'Image', 'Core:Section', 'Slot', 'Symbol', 'Text', 'Custom Code', 'Embed',
	'Raw:Img', 'Builder:RawText', 'Builder:Accordion', 'Builder: Tabs', 'Video', 'Form:Form', 'Form:Input',
	'Form:SubmitButton', 'Form:Select', 'Form:TextArea', 'PersonalizationContainer'
]);

/** One registry per SDK: the stand-in registered under every custom component name the fixtures use.
 *  Built once per name set (as an app keeps its registry in a module constant). */
const registries = new Map<string, Record<Sdk, unknown[]>>();
export function components_for(names: string[]): Record<Sdk, unknown[]> {
	const key = names.join('\0');
	let r = registries.get(key);
	if (!r) {
		const custom = names.filter((n) => !BUILT_IN.has(n));
		r = {
			official: custom.map((name) => ({ name, component: StubOfficial, shouldReceiveBuilderProps: ALL_PROPS })),
			ours: custom.map((name) => ({ name, component: StubOurs, shouldReceiveBuilderProps: ALL_PROPS }))
		};
		registries.set(key, r);
	}
	return r;
}

export function render_content(sdk: Sdk, props: Record<string, unknown>): { head: string; body: string } {
	const Content = sdk === 'official' ? OfficialContent : OursContent;
	// Svelte 5's render() is lazy: the work happens when `body`/`head` are read — read them here, so
	// every caller (and every timer) measures the real render.
	const out = render(Content as never, { props: props as never });
	return { head: out.head, body: out.body };
}

// ── APP-SHAPED page (the field app's patterns; see bench/app/sdk.ts) ─────────────────────────────
const BLOCK_ONLY = { builderBlock: true };
const REMOVED_BUILT_INS = ['Image', 'Core:Button', 'Columns', 'Core:Section', 'Embed', 'Custom Code'];

/** Editor metadata the way field component infos carry it: inputs with image fields and onChange
 *  hooks (the official SDK serializes every info, functions included, per <Content>). */
function inputs_for(name: string, i: number) {
	return [
		{ name: 'title', type: 'string', defaultValue: name },
		{ name: 'image', type: 'file', allowedFileTypes: ['jpeg', 'jpg', 'png', 'svg', 'webp'], required: false },
		{ name: 'mobileImage', type: 'file', allowedFileTypes: ['jpeg', 'jpg', 'png', 'svg', 'webp'] },
		{
			name: 'items',
			type: 'list',
			subFields: [
				{ name: 'label', type: 'string' },
				{ name: 'link', type: 'url' },
				{ name: 'icon', type: 'file', allowedFileTypes: ['svg'] }
			],
			onChange: new Function('options', `if (options.get('items').length > ${8 + (i % 5)}) { options.set('items', options.get('items').slice(0, ${8 + (i % 5)})); alert('max items'); }`)
		},
		{ name: 'variant', type: 'enum', enum: ['primary', 'secondary', 'ghost'], defaultValue: 'primary' }
	];
}

export interface AppRegistryOptions {
	/** real component names on the page (become Leaf, or NoWrap for the footer) */
	names: string[];
	/** total registry size (fillers pad the list — the field landing list has ~230) */
	size: number;
}

/** One SDK's field-shaped component list: the page's names + fillers + removed built-ins. */
export function app_components(sdk: Sdk, { names, size }: AppRegistryOptions): unknown[] {
	const list: unknown[] = [];
	let i = 0;
	const add = (name: string, component: unknown, extra: Record<string, unknown> = {}) =>
		list.push({ name, component, shouldReceiveBuilderProps: BLOCK_ONLY, inputs: inputs_for(name, i++), ...extra });
	for (const name of names) {
		if (BUILT_IN.has(name)) continue;
		if (name === 'Content - Footer') add(name, NoWrap, { noWrap: true });
		else if (name === '@app/ChildrenOption') add(name, ChildrenOption);
		else if (name === '@app/ContextReader') add(name, ContextReader, { shouldReceiveBuilderProps: { builderContext: true } });
		else add(name, Leaf);
	}
	while (list.length < size) add(`Filler ${list.length}`, Leaf);
	for (const name of REMOVED_BUILT_INS) list.push({ name, hideFromInsertMenu: true });
	void sdk;
	return list;
}

export interface AppRoot {
	model: string;
	content: unknown;
	components: unknown[];
	locale?: string;
	data?: Record<string, unknown>;
}

/** A whole field page (several <Content> roots) through one SDK. */
export function render_app_page(sdk: Sdk, roots: AppRoot[]): { head: string; body: string } {
	current.sdk = sdk;
	current.Blocks = sdk === 'official' ? OfficialBlocks : OursBlocks;
	const out = render(Page as never, { props: { Content: sdk === 'official' ? OfficialContent : OursContent, roots } as never });
	return { head: out.head, body: out.body };
}

/** Tests: render plain subtrees as strings (default) or as live blocks. */
export function set_plain(on: boolean): void {
	PLAIN.on = on;
}

export function set_echo(on: boolean): void {
	(globalThis as { __stub_echo?: boolean }).__stub_echo = on;
}
