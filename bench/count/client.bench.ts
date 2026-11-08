/**
 * COUNTED CLIENT: the browser-side work of the SDK, `.svelte` compiled as client output, on a DOM
 * (bench/count/dom.ts; the DOM's own work is not counted). Hydrating server HTML, mounting from
 * scratch, and a new content handed to a mounted page (a client navigation). The editor's live
 * re-render (preview or editing mode, coalesced per frame) is not here: its data side is
 * bench/count/live.bench.ts, its re-render tests/editor-perf.test.ts (Chromium).
 *   heisenbench run bench/count/client.bench.ts --svelte client --conditions svelte --import bench/count/dom.ts
 *   (the client run of `pnpm bench:count`)
 * The hydration markup is the server render of bench/dist (`pnpm bench:build`).
 */
import { bench } from 'heisenbench/bench';
import { flushSync, hydrate, mount } from 'svelte';
import { Content } from '../../src/lib/index.ts';
import StubOurs from '../stubs/StubOurs.svelte';
import Swap from './Swap.svelte';
import { fixture_text, names_in, spec_of, type Json } from './data.ts';

const ALL_PROPS = { builderBlock: true, builderContext: true, builderComponents: true, builderLinkComponent: true };
const BUILT_IN = new Set(['Core:Button', 'Columns', 'Fragment', 'Image', 'Core:Section', 'Slot', 'Symbol', 'Text', 'Custom Code', 'Embed', 'Raw:Img', 'Builder:RawText', 'Builder:Accordion', 'Builder: Tabs', 'Video', 'Form:Form', 'Form:Input', 'Form:SubmitButton', 'Form:Select', 'Form:TextArea', 'PersonalizationContainer']);

/** The stand-in registered under every custom component name (as bench/entry.ts does for SSR). */
function components(content: Json) {
	return [...names_in(content)].sort().filter((name) => !BUILT_IN.has(name)).map((name) => ({ name, component: StubOurs, shouldReceiveBuilderProps: ALL_PROPS }));
}

function target(html = ''): HTMLElement {
	const el = document.createElement('div');
	el.innerHTML = html;
	document.body.replaceChildren(el);
	return el;
}

const props_of = (content: Json) => ({ content, model: 'page', apiKey: 'bench', customComponents: components(content), canTrack: false });

/** The server HTML of a content, from the Vite-built server bundle (bench/dist/entry.js). */
async function server_html(content: Json): Promise<string> {
	const { render_content, components_for } = await import('../dist/entry.js');
	return render_content('ours', { ...props_of(content), customComponents: components_for([...names_in(content)].sort()).ours }).body;
}

for (const name of ['gen/page-50k', 'gen/feat-bindings']) {
	const raw = fixture_text(name);
	const fresh = () => spec_of(raw).content;

	// (props, the component list included, are made in setup: only the SDK's work is counted)
	bench(`client · ${name} · hydrate server HTML`, ({ el, props }) => {
		hydrate(Content, { target: el, props: props as never });
		flushSync();
		return el.childElementCount;
	}, {
		setup: async () => ({ el: target(await server_html(fresh())), props: props_of(fresh()) })
	});

	bench(`client · ${name} · mount`, ({ el, props }) => {
		mount(Content, { target: el, props: props as never });
		flushSync();
		return el.childElementCount;
	}, {
		setup: () => ({ el: target(), props: props_of(fresh()) })
	});

	/** A mounted page, and the content it will be handed next. */
	const mounted = (next: () => Json) => {
		const current = fresh();
		const app = mount(Swap, { target: target(), props: { initial: current, components: components(current) } }) as { set(c: unknown): void };
		flushSync();
		return { app, next: next() };
	};

	bench(`client · ${name} · new content (client navigation)`, ({ app, next }) => {
		app.set(next);
		flushSync();
	}, {
		setup: () => mounted(() => fresh())
	});
}
