// The built-in infos the editor is sent (`builder.registerComponent`): ours equal the official
// `getDefaultRegisteredComponents()` ones (TARGET 'svelte'), in order, key for key, function for function.
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NOT_IN_EDITOR, serialize_including_functions } from '../src/lib/internal/editor.js';
// The official infos, from source (plain TS; the same files constants/builder-registered-components.ts
// and constants/extra-components.ts spread, in that order).
import { componentInfo as button } from '../node_modules/@builder.io/sdk-svelte/src/blocks/button/component-info';
import { componentInfo as columns } from '../node_modules/@builder.io/sdk-svelte/src/blocks/columns/component-info';
import { componentInfo as fragment } from '../node_modules/@builder.io/sdk-svelte/src/blocks/fragment/component-info';
import { componentInfo as image } from '../node_modules/@builder.io/sdk-svelte/src/blocks/image/component-info';
import { componentInfo as section } from '../node_modules/@builder.io/sdk-svelte/src/blocks/section/component-info';
import { componentInfo as slot } from '../node_modules/@builder.io/sdk-svelte/src/blocks/slot/component-info';
import { componentInfo as symbol } from '../node_modules/@builder.io/sdk-svelte/src/blocks/symbol/component-info';
import { componentInfo as text } from '../node_modules/@builder.io/sdk-svelte/src/blocks/text/component-info';
import { componentInfo as personalization } from '../node_modules/@builder.io/sdk-svelte/src/blocks/personalization-container/component-info';
import { componentInfo as tabs } from '../node_modules/@builder.io/sdk-svelte/src/blocks/tabs/component-info';
import { componentInfo as accordion } from '../node_modules/@builder.io/sdk-svelte/src/blocks/accordion/component-info';
import { componentInfo as custom_code } from '../node_modules/@builder.io/sdk-svelte/src/blocks/custom-code/component-info';
import { componentInfo as embed } from '../node_modules/@builder.io/sdk-svelte/src/blocks/embed/component-info';
import { componentInfo as form } from '../node_modules/@builder.io/sdk-svelte/src/blocks/form/form/component-info';
import { componentInfo as form_input } from '../node_modules/@builder.io/sdk-svelte/src/blocks/form/input/component-info';
import { componentInfo as form_submit } from '../node_modules/@builder.io/sdk-svelte/src/blocks/form/submit-button/component-info';
import { componentInfo as form_select } from '../node_modules/@builder.io/sdk-svelte/src/blocks/form/select/component-info';
import { componentInfo as form_textarea } from '../node_modules/@builder.io/sdk-svelte/src/blocks/form/textarea/component-info';
import { componentInfo as img } from '../node_modules/@builder.io/sdk-svelte/src/blocks/img/component-info';
import { componentInfo as video } from '../node_modules/@builder.io/sdk-svelte/src/blocks/video/component-info';
import { componentInfo as raw_text } from '../node_modules/@builder.io/sdk-svelte/src/blocks/raw-text/component-info';

// defaults.ts imports the block components; this config compiles no `.svelte`, and the infos do not need them.
const BLOCKS = path.resolve(import.meta.dirname, '../src/lib/blocks');
for (const file of fs.readdirSync(BLOCKS)) if (file.endsWith('.svelte')) vi.doMock(path.join(BLOCKS, file), () => ({ default: {} }));
const { default_components } = await import('../src/lib/internal/defaults.js');

const OFFICIAL = [
	button,
	columns,
	fragment,
	image,
	section,
	slot,
	symbol,
	text,
	personalization,
	tabs,
	accordion,
	custom_code,
	embed,
	form,
	form_input,
	form_submit,
	form_select,
	form_textarea,
	img,
	video
];

/** What the editor is sent for an entry: its info without `component`, functions as source
 *  (content.svelte: `({ component: _, ...info }) => serializeIncludingFunctions(info)`).
 *  The ONE normalisation: each line's leading indentation in a function's source. The transpiler
 *  indents by nesting depth, and ours sit one level deeper (inside a builder function). */
const sent = ({ component: _, ...info }: Record<string, unknown>) =>
	JSON.parse(JSON.stringify(serialize_including_functions(info)), (_k, v) =>
		typeof v === 'string' && v.startsWith('return (') ? v.replace(/\n[ \t]+/g, '\n') : v
	);
const in_editor = () => default_components().filter((c) => !(c as Record<symbol, unknown>)[NOT_IN_EDITOR]);

describe('built-in component infos', () => {
	it('the editor gets the official list, in order', () => {
		expect(in_editor().map((c) => c.name)).toEqual(OFFICIAL.map((c) => c.name));
	});

	for (const official of OFFICIAL) {
		it(`${official.name}: the same serialized info, in the same key order`, () => {
			const ours = in_editor().find((c) => c.name === official.name)!;
			const a = sent(ours);
			const b = sent(official as never);
			expect(a).toEqual(b);
			// toEqual ignores key order; the editor's JSON does not
			expect(JSON.stringify(a)).toBe(JSON.stringify(b));
		});
	}

	it('the serialized functions are the official ones', () => {
		const fns = (v: unknown) => JSON.stringify(v).match(/"return \((?:[^"\\]|\\.)*"/g) ?? [];
		const ours = in_editor().flatMap((c) => fns(sent(c)));
		expect(ours.length).toBe(5); // Columns onChange, Image onChange, Accordion showIf ×2 + onChange
		expect(ours).toEqual(OFFICIAL.flatMap((c) => fns(sent(c as never))));
	});

	it('Builder:RawText is ours only: registered, never sent to the editor', () => {
		const ours = default_components().find((c) => c.name === 'Builder:RawText')!;
		expect(ours).toBeDefined();
		expect((ours as Record<symbol, unknown>)[NOT_IN_EDITOR]).toBe(true);
		expect(OFFICIAL.some((c) => c.name === 'Builder:RawText')).toBe(false);
		// its info still mirrors the official file
		expect(JSON.stringify(sent(ours))).toBe(JSON.stringify(sent(raw_text as never)));
	});
});
