/**
 * Shared logic of the stand-in custom component both SDKs render (StubOfficial / StubOurs differ
 * only in which `<Blocks>` they import). In echo mode (tests) it prints a digest of the props it
 * received, so the equivalence test also compares what reaches a custom component.
 */
const ELEMENT = '@builder.io/sdk:Element';
const OMIT = new Set(['builderBlock', 'builderContext', 'builderComponents', 'builderLinkComponent', 'attributes', 'children']);

export function nested_blocks(props: Record<string, unknown>): Array<[string, unknown[]]> {
	const out: Array<[string, unknown[]]> = [];
	for (const key in props) {
		if (OMIT.has(key)) continue;
		const v = props[key];
		if (Array.isArray(v) && v.length && (v[0] as Record<string, unknown>)?.['@type'] === ELEMENT) out.push([key, v]);
	}
	return out;
}

/** FNV-1a over the options' JSON (functions dropped) — echo mode only. */
export function digest(props: Record<string, unknown>): string {
	if (!(globalThis as { __stub_echo?: boolean }).__stub_echo) return '';
	const opts: Record<string, unknown> = {};
	for (const key of Object.keys(props).sort()) if (!OMIT.has(key)) opts[key] = props[key];
	const json = JSON.stringify(opts, (_k, v) => (typeof v === 'function' ? undefined : v));
	let h = 0x811c9dc5;
	for (let i = 0; i < json.length; i++) {
		h ^= json.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0).toString(16) + ':' + json.length;
}
