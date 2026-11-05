/**
 * The component tests' harness: one content, server-rendered three ways, and compared.
 *
 *  - official: the pinned official SDK, from the bench bundle (`pnpm bench:build`, bench/entry.ts);
 *  - ours: our <Content>, compiled from source by vitest (so coverage counts src/lib);
 *  - live: our ContentView with `live: true` — the editor's plan (no shared sheet, no plain
 *    strings, a style tag per block) — which must give the same page as the static render.
 *
 * `check(props)` asserts the three agree (tests/normalize.ts: the same DOM tree, the same CSS rules,
 * the same props reaching every custom component) and that ours is byte-identical with plain
 * subtrees on and off, then hands back everything for ours-only assertions.
 *
 * Custom components are given by kind (`stub`, `nowrap`, `echo`, `probe`, `lazy`, `none`) and become
 * the official build's copy of the component on its side and the source copy on ours.
 */
import { expect, vi } from 'vitest';
import { render } from 'svelte/server';
import { normalize, type Normalized } from '../../normalize.js';
import { Content, Blocks } from '../../../src/lib/index.js';
import ContentView from '../../../src/lib/components/ContentView.svelte';
import { PLAIN } from '../../../src/lib/internal/plain.js';
import StubOurs from '../../../bench/stubs/StubOurs.svelte';
import NoWrapStub from '../../../bench/stubs/unit/NoWrapStub.svelte';
import LinkStub from '../../../bench/stubs/unit/LinkStub.svelte';
import PropsEcho from '../../../bench/stubs/unit/PropsEcho.svelte';
import Fallback from '../../../bench/stubs/unit/Fallback.svelte';
import ProbeOurs from '../../../bench/stubs/unit/ProbeOurs.svelte';
// @ts-ignore built by `pnpm bench:build`
import { official_test_components, render_blocks, render_content, set_echo } from '../../../bench/dist/entry.js';

export const ELEMENT = '@builder.io/sdk:Element';
const BUILDER_ID_RE = /builder-id="([^"]+)"/g;
const CLASS_ID_RE = /\.(builder-[a-z0-9-]+?)(?=[\s{:.>,]|-breakpoints)/g;
const COMMENT_RE = /<!--[^]*?-->/g;

type Sdk = 'official' | 'ours';
const OURS = { Stub: StubOurs, NoWrapStub, LinkStub, PropsEcho, Fallback, Probe: ProbeOurs };
const OFFICIAL = official_test_components as typeof OURS;
const sides: Record<Sdk, typeof OURS> = { official: OFFICIAL, ours: OURS };

export const ALL_PROPS = { builderBlock: true, builderContext: true, builderComponents: true, builderLinkComponent: true };

// ── blocks ──────────────────────────────────────────────────────────────────────────────────────
export type Block = Record<string, any>;

/** A block: `el('a', { tagName: 'span' })`. */
export function el(id: string | undefined, rest: Block = {}): Block {
	return { '@type': ELEMENT, ...(id === undefined ? {} : { id: id.startsWith('builder-') ? id : `builder-${id}` }), ...rest };
}

/** A block of a component: `comp('a', 'Core:Button', { text: 'Go' })`. */
export function comp(id: string, name: string, options: Record<string, unknown> = {}, rest: Block = {}): Block {
	return el(id, { component: { name, options }, ...rest });
}

/** A Text block. */
export function text(id: string, html: string, rest: Block = {}): Block {
	return comp(id, 'Text', { text: html }, rest);
}

/** A content with these blocks (plus any other content fields / data). */
export function page(blocks: Block[], data: Record<string, unknown> = {}, rest: Record<string, unknown> = {}): Record<string, any> {
	return { id: 'content-1', data: { blocks, ...data }, ...rest };
}

// ── components ──────────────────────────────────────────────────────────────────────────────────
export type Kind = 'stub' | 'nowrap' | 'echo' | 'probe' | 'lazy' | 'lazy-no-fallback' | 'none';
export type CompSpec = { name: string; kind?: Kind; [k: string]: unknown };

function entry_for(sdk: Sdk, spec: CompSpec): Record<string, unknown> {
	const { kind = 'stub', ...rest } = spec;
	const c = sides[sdk];
	switch (kind) {
		case 'none':
			return { ...rest };
		case 'nowrap':
			return { component: c.NoWrapStub, noWrap: true, shouldReceiveBuilderProps: ALL_PROPS, ...rest };
		case 'echo':
			return { component: c.PropsEcho, ...rest };
		case 'probe':
			return { component: c.Probe, shouldReceiveBuilderProps: ALL_PROPS, ...rest };
		case 'lazy':
		case 'lazy-no-fallback':
			return {
				component: { load: () => Promise.resolve({ default: c.Stub }), ...(kind === 'lazy' ? { fallback: c.Fallback } : {}) },
				shouldReceiveBuilderProps: ALL_PROPS,
				...rest
			};
		default:
			return { component: c.Stub, shouldReceiveBuilderProps: ALL_PROPS, ...rest };
	}
}

/** A component list for one SDK (a fresh array: the test does not rely on registry caching). */
export function components(sdk: Sdk, specs: CompSpec[] | undefined): unknown[] | undefined {
	return specs?.map((s) => entry_for(sdk, s));
}

/** The link component of one SDK's side. */
export const link_component = (sdk: Sdk) => sides[sdk].LinkStub;

// ── rendering ───────────────────────────────────────────────────────────────────────────────────
export interface Props {
	content?: unknown;
	customComponents?: CompSpec[];
	/** `true`: the test LinkStub as `linkComponent`. */
	link?: boolean;
	[k: string]: unknown;
}

const clone = <T>(v: T): T => (v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)));

/** The props one SDK renders: defaults (model page, an api key, no tracking), the content cloned. */
export function props_for(sdk: Sdk, p: Props): Record<string, unknown> {
	const { customComponents, link, ...rest } = p;
	const out: Record<string, unknown> = { model: 'page', apiKey: 'test-key', canTrack: false, ...rest };
	if ('content' in p) out.content = clone(p.content);
	if ('data' in p) out.data = clone(p.data);
	if (customComponents) out.customComponents = components(sdk, customComponents);
	if (link) out.linkComponent = link_component(sdk);
	return out;
}

export function official_html(p: Props): string {
	return render_content('official', props_for('official', p)).body;
}

export function ours_html(p: Props): string {
	return render(Content as never, { props: props_for('ours', p) as never }).body;
}

/** Our ContentView rendered live (the editor's plan), as `<Content>` renders it after going live. */
export function live_html(p: Props): string {
	return render(ContentView as never, { props: { ...props_for('ours', p), live: true } as never }).body;
}

/** Our <Content> with plain subtrees off (every block a live <Block>). */
export function unplain_html(p: Props): string {
	PLAIN.on = false;
	try {
		return ours_html(p);
	} finally {
		PLAIN.on = true;
	}
}

export function blocks_html(sdk: Sdk, props: Record<string, unknown>): string {
	if (sdk === 'official') return render_blocks('official', props).body;
	return render(Blocks as never, { props: props as never }).body;
}

// ── comparing ───────────────────────────────────────────────────────────────────────────────────
/** The CSS rules `b` lacks of `a`'s. */
export function missing_css(a: Normalized, b: Normalized): string[] {
	return a.css.filter((r) => !b.css.includes(r));
}

/** `b`'s extra rules that reach a block `b` renders (rules for blocks never rendered have no effect). */
export function effective_extra_css(a: Normalized, b: Normalized): string[] {
	const rendered = new Set([...b.tree.matchAll(BUILDER_ID_RE)].map((m) => m[1]));
	return b.css.filter((r) => !a.css.includes(r)).filter((r) => [...r.matchAll(CLASS_ID_RE)].some((m) => rendered.has(m[1])));
}

/** Two renders give the same page: the same tree, and the same CSS on every rendered block. */
export function expect_same_page(reference: Normalized, actual: Normalized, label: string): void {
	expect(actual.tree, `${label}: tree`).toBe(reference.tree);
	expect(missing_css(reference, actual), `${label}: css missing`).toEqual([]);
	expect(effective_extra_css(reference, actual), `${label}: css extra`).toEqual([]);
}

export interface Checked {
	official: Normalized;
	ours: Normalized;
	live: Normalized;
	html: { official: string; ours: string; live: string };
}

export interface CheckOptions {
	/** compare with the official SDK (default true) */
	official?: boolean;
	/** compare the live render (default true) */
	live?: boolean;
}

/**
 * Render `p` through both SDKs and live, and assert they all give the same page; ours also
 * byte-identical with plain subtrees off.
 */
export function check(p: Props, opts: CheckOptions = {}): Checked {
	const html = { official: opts.official === false ? '' : official_html(p), ours: ours_html(p), live: opts.live === false ? '' : live_html(p) };
	const out: Checked = { official: normalize(html.official), ours: normalize(html.ours), live: normalize(html.live), html };
	if (opts.official !== false) expect_same_page(out.official, out.ours, 'ours vs official');
	if (opts.live !== false) expect_same_page(opts.official === false ? out.ours : out.official, out.live, 'live vs static');
	expect(unplain_html(p).replace(COMMENT_RE, ''), 'plain off').toBe(html.ours.replace(COMMENT_RE, ''));
	return out;
}

/** Each case of a table, as its own test: `cases(it, { label: props })`. */
export function each_case(
	it: (name: string, fn: () => void) => void,
	table: Record<string, Props | (() => Props)>,
	opts: CheckOptions | ((label: string) => CheckOptions) = {},
	extra?: (c: Checked, label: string) => void
): void {
	for (const [label, entry] of Object.entries(table)) {
		it(label, () => {
			const p = typeof entry === 'function' ? entry() : entry;
			const c = check(p, typeof opts === 'function' ? opts(label) : opts);
			extra?.(c, label);
		});
	}
}

/** Echo on (stubs print a digest of their props), console quiet, no network: call in beforeAll. */
export function setup(): { fetches: string[] } {
	set_echo(true);
	const fetches: string[] = [];
	for (const m of ['log', 'warn', 'error', 'info', 'debug'] as const) vi.spyOn(console, m).mockImplementation(() => {});
	vi.stubGlobal('fetch', (url: unknown) => {
		fetches.push(String(url));
		return Promise.reject(new Error('unit: no network'));
	});
	return { fetches };
}

export function teardown(): void {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
}

/** The elements of a tree line by line matching `re` (ours-only assertions on the normalized tree). */
export function lines(n: Normalized, re: RegExp): string[] {
	return n.tree.split('\n').filter((l) => re.test(l)).map((l) => l.trim());
}
