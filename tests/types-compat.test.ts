// An app that installs this package UNDER THE OFFICIAL NAME (`"@builder.io/sdk-svelte":
// "npm:@puruvj/builder-sdk-svelte"`) keeps its type imports — the root ones and the official deep
// paths (`@builder.io/sdk-svelte/src/types/builder-block`, every type module the official package
// ships) — and they are the SAME types the root exports, accepted by every public component and
// function. Checked with svelte-check in both module resolutions an app may use. Needs `pnpm build`.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OFFICIAL_SRC = path.join(ROOT, 'node_modules/@builder.io/sdk-svelte/src');
const VENDORED = path.join(ROOT, 'src/lib/official');
const built = fs.existsSync(path.join(ROOT, 'dist/official/types/builder-block.d.ts'));

const walk = (dir: string): string[] =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

/** Every deep type path: each vendored module, by its official path (it exists in the official package). */
const deep_paths = (): string[] =>
	walk(VENDORED)
		.filter((f) => f.endsWith('.ts'))
		.map((f) => path.relative(VENDORED, f).replace(/\.ts$/, ''))
		.filter((rel) => fs.existsSync(path.join(OFFICIAL_SRC, rel + '.ts')))
		.sort();

/** The official package's entry points (`exports`), and the bare runtime names some apps use. */
const ENTRY_POINTS = ['bundle/browser', 'bundle/node', 'bundle/edge', 'browser', 'node', 'edge'];

const CONSUMER_TS = (paths: string[]) => `
${paths.map((p, i) => `import type * as deep_${i} from '@builder.io/sdk-svelte/src/${p}';`).join('\n')}
import type { BuilderBlock as DeepBlock, BuilderAnimation } from '@builder.io/sdk-svelte/src/types/builder-block';
import type { BuilderContent as DeepContent } from '@builder.io/sdk-svelte/src/types/builder-content.js';
import type { RegisteredComponent as DeepRegistered, BuilderContextInterface as DeepContext } from '@builder.io/sdk-svelte/src/context/types';
import type { ComponentInfo as DeepInfo } from '@builder.io/sdk-svelte/src/types/components';
import type { ContentVariantsPrps } from '@builder.io/sdk-svelte/src/components/content-variants/content-variants.types';
import type { GetContentOptions as DeepOptions } from '@builder.io/sdk-svelte/src/functions/get-content/types';
import {
	Blocks,
	Content,
	fetchEntries,
	fetchOneEntry,
	fetchBuilderProps,
	subscribeToEditor,
	type BuilderBlock,
	type BuilderContent,
	type BuilderContextInterface,
	type ComponentInfo,
	type ContentProps,
	type GetContentOptions,
	type RegisteredComponent
} from '@builder.io/sdk-svelte';
import type { ComponentProps } from 'svelte';
${ENTRY_POINTS.map((e, i) => `import { Content as Content_${i}, type BuilderContent as Content_type_${i} } from '@builder.io/sdk-svelte/${e}';`).join('\n')}

// the official entry points are the root: the same components, the same types
${ENTRY_POINTS.map((_, i) => `export const _entry_${i}: [typeof Content, (c: Content_type_${i}) => BuilderContent, (c: BuilderContent) => Content_type_${i}] = [Content_${i}, (c) => c, (c) => c];`).join('\n')}

export type _deep = [${paths.map((_, i) => `typeof deep_${i}`).join(', ')}];

// the deep types and the root types are the same, both ways
const a1 = (b: DeepBlock): BuilderBlock => b;
const a2 = (b: BuilderBlock): DeepBlock => b;
const a3 = (c: DeepContent): BuilderContent => c;
const a4 = (c: BuilderContent): DeepContent => c;
const a5 = (r: DeepRegistered): RegisteredComponent => r;
const a6 = (i: DeepInfo): ComponentInfo => i;
const a7 = (x: DeepContext): BuilderContextInterface => x;
const a8 = (p: ContentVariantsPrps): ContentProps => p;
const a9 = (o: DeepOptions): GetContentOptions => o;
export const _same = [a1, a2, a3, a4, a5, a6, a7, a8, a9];

// the functions take and give the official types
export async function load(): Promise<DeepContent | null> {
	const one: DeepContent | null = await fetchOneEntry({ model: 'page', apiKey: 'k', query: { id: 'x' } });
	const many: DeepContent[] = await fetchEntries({ model: 'page', apiKey: 'k', limit: 2 });
	const props = await fetchBuilderProps({ model: 'page', apiKey: 'k', url: new URL('https://x.test/a') });
	const typed: DeepContent | null | undefined = props.content;
	subscribeToEditor({ model: 'page', apiKey: 'k', callback: (c: DeepContent) => void c.data?.blocks });
	return one ?? many[0] ?? typed ?? null;
}

// the components accept official-typed values
declare const content: DeepContent;
declare const registered: DeepRegistered[];
declare const blocks: DeepBlock[];
declare const animation: BuilderAnimation;
export const content_props: ComponentProps<typeof Content> = { content, customComponents: registered, model: 'page', apiKey: 'k' };
export const blocks_props: ComponentProps<typeof Blocks> = { blocks, parent: 'p', path: 'children' };
export const _animation = animation.trigger;
`;

const CONSUMER_SVELTE = `<script lang="ts">
	import { Blocks, Content, type BuilderBlock, type BuilderContent, type RegisteredComponent } from '@builder.io/sdk-svelte';
	import type { BuilderBlock as DeepBlock } from '@builder.io/sdk-svelte/src/types/builder-block';
	let { content, components, block }: { content: BuilderContent; components: RegisteredComponent[]; block: DeepBlock } = $props();
	const children: BuilderBlock[] = $derived(block.children ?? []);
</script>

<Content {content} customComponents={components} model="page" apiKey="k" />
<Blocks blocks={children} parent={block.id} path="children" />
`;

function check(resolution: 'bundler' | 'node10'): string {
	const dir = path.join(ROOT, `.check-types/${resolution}`);
	fs.rmSync(dir, { recursive: true, force: true });
	fs.mkdirSync(path.join(dir, 'node_modules/@builder.io'), { recursive: true });
	// installed under the official name, as `npm:@puruvj/builder-sdk-svelte` would
	fs.symlinkSync(ROOT, path.join(dir, 'node_modules/@builder.io/sdk-svelte'), 'dir');
	fs.symlinkSync(path.join(ROOT, 'node_modules/svelte'), path.join(dir, 'node_modules/svelte'), 'dir');
	fs.writeFileSync(path.join(dir, 'package.json'), '{ "name": "consumer", "private": true, "type": "module" }');
	fs.writeFileSync(
		path.join(dir, 'tsconfig.json'),
		JSON.stringify({
			compilerOptions: {
				target: 'ES2022',
				module: resolution === 'bundler' ? 'ESNext' : 'CommonJS',
				moduleResolution: resolution,
				strict: true,
				skipLibCheck: true,
				noEmit: true,
				verbatimModuleSyntax: resolution === 'bundler',
				lib: ['ES2022', 'DOM'],
				types: []
			},
			include: ['*.ts', '*.svelte']
		})
	);
	fs.writeFileSync(path.join(dir, 'consumer.ts'), CONSUMER_TS(deep_paths()));
	fs.writeFileSync(path.join(dir, 'Consumer.svelte'), CONSUMER_SVELTE);
	try {
		return execFileSync(path.join(ROOT, 'node_modules/.bin/svelte-check'), ['--workspace', dir, '--tsconfig', path.join(dir, 'tsconfig.json'), '--output', 'machine', '--threshold', 'error'], { encoding: 'utf8' });
	} catch (e) {
		return (e as { stdout?: string }).stdout ?? String(e);
	}
}

describe.skipIf(!built)('an app on the official type paths', () => {
	it('every official type module the package ships is vendored', () => {
		expect(deep_paths().length).toBeGreaterThanOrEqual(30);
	});
	it('the official entry points resolve to the root build at runtime', () => {
		const dir = path.join(ROOT, '.check-types/bundler');
		if (!fs.existsSync(dir)) check('bundler');
		const resolve = (spec: string) =>
			execFileSync(process.execPath, ['--input-type=module', '-e', `console.log(import.meta.resolve(${JSON.stringify(spec)}))`], { cwd: dir, encoding: 'utf8' }).trim();
		const root = resolve('@builder.io/sdk-svelte');
		expect(root).toMatch(/\/dist\/index\.js$/);
		for (const e of ENTRY_POINTS) expect(resolve(`@builder.io/sdk-svelte/${e}`), e).toBe(root);
	});
	for (const resolution of ['bundler', 'node10'] as const) {
		it(`type-checks with moduleResolution ${resolution}`, () => {
			const out = check(resolution);
			const errors = out.split('\n').filter((l) => l.includes(' ERROR '));
			expect(errors).toEqual([]);
			expect(out).toMatch(/COMPLETED \d+ FILES 0 ERRORS/);
		}, 120_000);
	}
});
