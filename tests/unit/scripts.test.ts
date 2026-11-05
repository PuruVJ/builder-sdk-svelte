// @vitest-environment happy-dom
// blocks/scripts.ts run_scripts vs the official `runScripts` (blocks/custom-code/custom-code.svelte) and
// `findAndRunScripts` (blocks/embed/embed.svelte + blocks/embed/helpers.ts). Neither is exported:
// both are copied below. The official logger is node_modules/@builder.io/sdk-svelte/src/helpers/logger.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run_scripts } from '../../src/lib/blocks/scripts';
import { logger } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/logger';
import { isJsScript } from '../../node_modules/@builder.io/sdk-svelte/src/blocks/embed/helpers';

/** Copied from custom-code.svelte. */
function official_custom_code(elementRef: any, scriptsInserted: string[], scriptsRun: string[]) {
	if (!elementRef || !elementRef?.getElementsByTagName || typeof window === 'undefined') {
		return;
	}
	const scripts = elementRef.getElementsByTagName('script');
	for (let i = 0; i < scripts.length; i++) {
		const script = scripts[i];
		if (script.src) {
			if (scriptsInserted.includes(script.src)) {
				continue;
			}
			scriptsInserted.push(script.src);
			const newScript = document.createElement('script');
			newScript.async = true;
			newScript.src = script.src;
			document.head.appendChild(newScript);
		} else if (!script.type || ['text/javascript', 'application/javascript', 'application/ecmascript'].includes(script.type)) {
			if (scriptsRun.includes(script.innerText)) {
				continue;
			}
			try {
				scriptsRun.push(script.innerText);
				new Function(script.innerText)();
			} catch (error) {
				logger.warn('[BUILDER.IO] `CustomCode`: Error running script:', error);
			}
		}
	}
}

/** Copied from embed.svelte. */
function official_embed(elem: any, scriptsInserted: string[], scriptsRun: string[]) {
	if (!elem || !elem.getElementsByTagName) return;
	const scripts = elem.getElementsByTagName('script');
	for (let i = 0; i < scripts.length; i++) {
		const script = scripts[i];
		if (script.src && !scriptsInserted.includes(script.src)) {
			scriptsInserted.push(script.src);
			const newScript = document.createElement('script');
			newScript.async = true;
			newScript.src = script.src;
			document.head.appendChild(newScript);
		} else if (isJsScript(script) && !scriptsRun.includes(script.innerText)) {
			try {
				scriptsRun.push(script.innerText);
				new Function(script.innerText)();
			} catch (error) {
				logger.warn('[BUILDER.IO] `Embed`: Error running script:', error);
			}
		}
	}
}

type Trace = { appended: Array<{ src: string; async: boolean }>; ran: string[]; warned: number; inserted: string[]; run: string[] };

const g = globalThis as any;
let appended: Array<{ src: string; async: boolean }>;

beforeEach(() => {
	appended = [];
	g.__ran = [];
	// (no network: record the appended script instead of letting happy-dom fetch it)
	vi.spyOn(document.head, 'appendChild').mockImplementation(((node: HTMLScriptElement) => {
		appended.push({ src: node.src, async: node.async });
		return node;
	}) as any);
});
afterEach(() => {
	vi.restoreAllMocks();
	delete g.__ran;
});

function host(html: string) {
	const el = document.createElement('div');
	el.innerHTML = html;
	return el;
}

function trace(fn: (el: HTMLElement, inserted: string[], run: string[]) => void, html: string, times = 1): Trace {
	appended = [];
	g.__ran = [];
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const el = host(html);
	const inserted: string[] = [];
	const run: string[] = [];
	for (let i = 0; i < times; i++) fn(el, inserted, run);
	const out = { appended, ran: g.__ran.slice(), warned: warn.mock.calls.length, inserted: inserted.slice(), run: run.slice() };
	warn.mockRestore();
	return out;
}

const ours = (label: string) => (el: HTMLElement, inserted: string[], run: string[]) => run_scripts(el, inserted, run, label);

const HTML = [
	'',
	'<p>no scripts</p>',
	'<script>__ran.push("a")</script>',
	'<script>__ran.push("a")</script><script>__ran.push("a")</script>', // same text: once
	'<script>__ran.push("a")</script><script>__ran.push("b")</script>',
	'<script type="text/javascript">__ran.push("tj")</script>',
	'<script type="application/javascript">__ran.push("aj")</script>',
	'<script type="application/ecmascript">__ran.push("ae")</script>',
	'<script type="module">__ran.push("module")</script>',
	'<script type="application/ld+json">{"a":1}</script>',
	'<script type="text/template">__ran.push("tpl")</script>',
	'<script type="TEXT/JAVASCRIPT">__ran.push("upper")</script>',
	'<script src="https://x.test/a.js"></script>',
	'<script src="https://x.test/a.js"></script><script src="https://x.test/a.js"></script>',
	'<script src="https://x.test/a.js"></script><script src="https://x.test/b.js" type="module"></script>',
	'<script>throw new Error("boom")</script><script>__ran.push("after")</script>',
	'<script>syntax error here(</script>',
	'<div><span><script>__ran.push("nested")</script></span></div>',
	'<script>__ran.push("ü日本😀")</script>'
];

describe('run_scripts vs official CustomCode runScripts', () => {
	it('table: same appended scripts, same scripts run, same warnings', () => {
		for (const html of HTML) {
			expect(trace(ours('CustomCode'), html), html).toEqual(trace(official_custom_code, html));
			// run twice on the same element with the same bookkeeping: still once each
			expect(trace(ours('CustomCode'), html, 2), html).toEqual(trace(official_custom_code, html, 2));
		}
	});

	it('src scripts are appended once, async, to head', () => {
		const t = trace(ours('CustomCode'), '<script src="https://x.test/a.js"></script><script src="https://x.test/a.js"></script>', 3);
		expect(t.appended).toEqual([{ src: 'https://x.test/a.js', async: true }]);
		expect(t.inserted).toEqual(['https://x.test/a.js']);
	});

	it('inline scripts run once; new content with new text runs', () => {
		const el = host('<script>__ran.push(1)</script>');
		const inserted: string[] = [];
		const run: string[] = [];
		run_scripts(el, inserted, run, 'CustomCode');
		run_scripts(el, inserted, run, 'CustomCode');
		expect(g.__ran).toEqual([1]);
		el.innerHTML = '<script>__ran.push(2)</script>';
		run_scripts(el, inserted, run, 'CustomCode');
		expect(g.__ran).toEqual([1, 2]);
	});

	it('errors are warned with the label and do not stop later scripts', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		run_scripts(host('<script>throw new Error("boom")</script><script>__ran.push("next")</script>'), [], [], 'MyLabel');
		expect(g.__ran).toEqual(['next']);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toBe('[Builder.io]: [BUILDER.IO] `MyLabel`: Error running script:');
		expect((warn.mock.calls[0][1] as Error).message).toBe('boom');
		// The official logs the same text as separate arguments: console.warn('[Builder.io]: ', '[BUILDER.IO] ...', error).
		warn.mockClear();
		official_custom_code(host('<script>throw new Error("boom")</script>'), [], []);
		expect(warn.mock.calls[0].slice(0, 2)).toEqual(['[Builder.io]: ', '[BUILDER.IO] `CustomCode`: Error running script:']);
	});

	it('no element / no getElementsByTagName: no-op', () => {
		expect(() => run_scripts(undefined, [], [], 'X')).not.toThrow();
		expect(() => run_scripts({} as HTMLElement, [], [], 'X')).not.toThrow();
		expect(() => run_scripts(null as unknown as HTMLElement, [], [], 'X')).not.toThrow();
		expect(appended).toEqual([]);
	});

	it('no window (server): no-op', () => {
		const el = host('<script>__ran.push("x")</script>');
		vi.stubGlobal('window', undefined);
		try {
			run_scripts(el, [], [], 'X');
		} finally {
			vi.unstubAllGlobals();
		}
		expect(g.__ran).toEqual([]);
	});
});

describe('run_scripts vs official Embed findAndRunScripts', () => {
	// The official Embed only runs scripts whose type is exactly one of the three JS MIME types
	// (embed/helpers.ts isJsScript): an inline `<script>` with NO type attribute (type '') never runs
	// there. Ours shares the CustomCode rule and runs it. See the report: a behaviour difference.
	const TYPED_ONLY = HTML.filter((h) => !/<script>/.test(h));

	it('same as the official for typed and src scripts', () => {
		for (const html of TYPED_ONLY) expect(trace(ours('Embed'), html), html).toEqual(trace(official_embed, html));
	});

	it('untyped inline scripts: ours runs them, the official Embed does not', () => {
		const html = '<script>__ran.push("untyped")</script>';
		expect(trace(ours('Embed'), html).ran).toEqual(['untyped']);
		expect(trace(official_embed, html).ran).toEqual([]);
	});

	it('Embed label in warnings', () => {
		const t = trace(ours('Embed'), '<script type="text/javascript">throw 1</script>');
		expect(t.warned).toBe(1);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		run_scripts(host('<script type="text/javascript">throw 1</script>'), [], [], 'Embed');
		expect(warn.mock.calls[0][0]).toContain('`Embed`');
	});
});
