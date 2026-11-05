/**
 * LIVE CONTENT — the editor and preview leg (official EnableEditor, minus the cost).
 *
 * Inside the Builder editor every keystroke posts the WHOLE content again (a structured clone: every
 * object new). The official SDK hands that to a store every block subscribes to, so each edit
 * re-processes every block on the page; on a page with hundreds of components that freezes the
 * editor. Here an update is made to cost what changed:
 *  - {@link reconcile} gives the new content the identity of the old wherever it is deep-equal, so an
 *    untouched block is the SAME object as before: its compiled record is a cache hit and Svelte sees
 *    no change below it. Only the edited block and its ancestors (now new objects) re-derive, and
 *    lists are keyed by block id (compile.ts `Plan.key`), so even those update in place.
 *  - updates are coalesced: a burst of messages applies once per frame ({@link coalesce}).
 */
import type { BuilderContent } from '../types.js';
import { is_browser, is_editing, is_previewing } from './env.js';

/** official `mergeNewContent`: the update over the current content (data and meta merged a level deep). */
export function merge_content(current: BuilderContent | undefined, next: BuilderContent | undefined): BuilderContent {
	return {
		...current,
		...next,
		data: { ...current?.data, ...next?.data },
		meta: {
			...current?.meta,
			...next?.meta,
			breakpoints: next?.meta?.breakpoints || current?.meta?.breakpoints
		}
	} as BuilderContent;
}

/** Deeper than this the content is taken as new (no sharing) instead of risking the stack. */
const MAX_DEPTH = 1500;

/** A block id worth matching by: a string or a number (content is data — an id can be anything). */
function id_of(v: unknown): string | number | undefined {
	if (typeof v !== 'object' || v === null) return undefined;
	const id = (v as { id?: unknown }).id;
	return typeof id === 'string' || typeof id === 'number' ? id : undefined;
}

function is_plain(v: object): boolean {
	const proto = Object.getPrototypeOf(v);
	return proto === Object.prototype || proto === null;
}

/**
 * `next`, with every part deep-equal to the matching part of `prev` replaced by that part of `prev`
 * (structural sharing). Returns `prev` itself when the two are deep-equal. Array items that carry an
 * `id` (blocks) are matched by id, so inserting or moving a block keeps its siblings' identity.
 * Never mutates either side.
 */
export function reconcile<T>(prev: unknown, next: T): T {
	try {
		return share(prev, next, 0) as T;
	} catch (error) {
		// (a stack already deep when called: no sharing is always correct, just slower)
		if (error instanceof RangeError) return next;
		throw error;
	}
}

function share(prev: unknown, next: unknown, depth: number): unknown {
	if (prev === next) return next;
	if (typeof next !== 'object' || next === null || typeof prev !== 'object' || prev === null) return next;
	if (depth > MAX_DEPTH) return next;
	if (Array.isArray(next)) {
		if (!Array.isArray(prev)) return next;
		let same = prev.length === next.length;
		let by_id: Map<string | number, unknown[]> | undefined;
		// Each old item is matched at most once: two new blocks with the same id (duplicated content)
		// must never become the same object — one list would then hold one object twice.
		let used: Set<unknown> | undefined;
		const out = new Array(next.length);
		for (let i = 0; i < next.length; i++) {
			const n = next[i];
			let p: unknown = prev[i];
			const id = id_of(n);
			if (id !== undefined && id_of(p) !== id) {
				if (!by_id) {
					by_id = new Map();
					for (const item of prev) {
						const item_id = id_of(item);
						if (item_id === undefined) continue;
						const same_id = by_id.get(item_id);
						if (same_id) same_id.push(item);
						else by_id.set(item_id, [item]);
					}
				}
				p = by_id.get(id)?.find((item) => !used?.has(item));
			}
			if (typeof p === 'object' && p !== null) {
				if (used?.has(p)) p = undefined;
				else (used ??= new Set()).add(p);
			}
			const r = share(p, n, depth + 1);
			out[i] = r;
			if (r !== prev[i]) same = false;
		}
		return same ? prev : out;
	}
	if (Array.isArray(prev) || !is_plain(next) || !is_plain(prev)) return next;
	const a = prev as Record<string, unknown>;
	const b = next as Record<string, unknown>;
	const keys = Object.keys(b);
	const prev_keys = Object.keys(a);
	// (key ORDER too: properties become attributes, in order)
	let same = keys.length === prev_keys.length;
	const out: Record<string, unknown> = {};
	for (let i = 0; i < keys.length; i++) {
		const k = keys[i];
		const r = share(Object.prototype.hasOwnProperty.call(a, k) ? a[k] : undefined, b[k], depth + 1);
		if (k === '__proto__') Object.defineProperty(out, k, { value: r, enumerable: true, writable: true, configurable: true });
		else out[k] = r;
		if (same && (prev_keys[i] !== k || r !== a[k])) same = false;
	}
	return same ? prev : out;
}

/**
 * A once-per-frame flush: `schedule()` any number of times, `flush` runs once, on the next frame —
 * or after a short timeout when frames are not running (a hidden or throttled frame).
 */
export function coalesce(flush: () => void): { schedule(): void; cancel(): void } {
	let raf = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let queued = false;
	const run = () => {
		if (!queued) return;
		queued = false;
		if (raf) cancelAnimationFrame(raf);
		if (timer) clearTimeout(timer);
		raf = 0;
		timer = undefined;
		flush();
	};
	return {
		schedule() {
			if (queued) return;
			queued = true;
			if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(run);
			timer = setTimeout(run, 50);
		},
		cancel() {
			queued = false;
			if (raf) cancelAnimationFrame(raf);
			if (timer) clearTimeout(timer);
		}
	};
}

/**
 * The page runs inside Builder (the editor, or a preview link): content renders live. Decided after
 * mount, never during the first render: the server rendered the static shape and the browser must
 * hydrate exactly that — and with Svelte's async mode a boundary can hydrate long after the page is
 * up, so "the page has started" says nothing about whether a component is hydrating.
 */
export const is_authoring = (): boolean => is_browser() && (is_editing() || is_previewing());
