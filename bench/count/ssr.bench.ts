/**
 * COUNTED SSR: the work of one server render of a fixture, counted by Heisenbench (exact steps per
 * function and line, the same on every run). The same entry the timed bench builds with Vite
 * (bench/entry.ts), so the counted render is the timed one; `.svelte` files compile as server output.
 *   pnpm bench:count
 */
import { bench } from 'heisenbench/bench';
import { components_for, render_content, type Sdk } from '../entry.ts';
import { fixture_text, names_in, repeat_blocks, spec_of, type Json } from './data.ts';

/** Fixtures counted for ours: the production-shaped size ladder's small end, shapes, every feature path. */
const OURS = [
	'gen/page-50k',
	'gen/page-250k',
	'gen/flat-1000',
	'gen/deep-200',
	'gen/feat-bindings',
	'gen/feat-breakpoints-css',
	'gen/feat-builtins',
	'gen/feat-columns',
	'gen/feat-elements',
	'gen/feat-js-state',
	'gen/feat-localized-fr',
	'gen/feat-repeat',
	'gen/feat-symbol-inline',
	'gen/feat-text-templates'
];
/** Fixtures counted for the official SDKs too: what this rewrite saves, in steps. */
const VERSUS = ['gen/page-50k', 'gen/feat-bindings'];

function props_for(sdk: Sdk, raw: string, content?: Json): Record<string, unknown> {
	const spec = spec_of(raw);
	const c = content ?? spec.content;
	const comps = components_for([...names_in(c)].sort())[sdk];
	return { content: c, model: 'page', apiKey: 'bench', customComponents: comps, canTrack: false, data: spec.data, locale: spec.locale };
}

// Svelte's render() is lazy: reading `body` is what runs it.
const render_body = (sdk: Sdk, props: Record<string, unknown>) => render_content(sdk, props).body.length;

for (const name of OURS) {
	const raw = fixture_text(name);
	bench(`ssr · ${name} · ours`, ({ props }) => render_body('ours', props), {
		setup: () => ({ props: props_for('ours', raw) }),
		// `heisenbench growth`: the page repeated, as a longer page of the same shape
		scale: (_ctx, factor) => ({ props: props_for('ours', raw, repeat_blocks(spec_of(raw).content, factor)) })
	});
}

// The same content object rendered again: the second request for a page the app keeps in memory
// (a cached plan, the `same` mode of bench/ssr.mjs).
const page = fixture_text('gen/page-50k');
const rendered_once = (content?: Json) => {
	const props = props_for('ours', page, content);
	render_body('ours', props);
	return { props };
};
bench('ssr · gen/page-50k · ours · same content again', ({ props }) => render_body('ours', props), {
	setup: () => rendered_once(),
	scale: (_ctx, factor) => rendered_once(repeat_blocks(spec_of(page).content, factor))
});

for (const name of VERSUS) {
	const raw = fixture_text(name);
	for (const sdk of ['official', 'latest'] as const) {
		bench(`ssr · ${name} · ${sdk === 'official' ? 'official 5.2' : 'official latest'}`, ({ props }) => render_body(sdk, props), {
			setup: () => ({ props: props_for(sdk, raw) })
		});
	}
}
