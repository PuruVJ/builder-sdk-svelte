// Copy the official SDK's public type modules into src/lib/official/, at the official paths.
//
// Apps import types from deep official paths (`@builder.io/sdk-svelte/src/types/builder-block`);
// package.json maps `./src/*` to `dist/official/*`, so those imports keep resolving — to the SAME
// declarations the package root exports. Run after bumping the official devDependency:
//   node scripts/vendor-official-types.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FROM = path.join(ROOT, 'node_modules/@builder.io/sdk-svelte/src');
const TO = path.join(ROOT, 'src/lib/official');
const version = JSON.parse(fs.readFileSync(path.join(FROM, '../package.json'), 'utf8')).version;

const walk = (dir) => fs.readdirSync(path.join(FROM, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));

const files = [
	...walk('types').filter((f) => f.endsWith('.ts')),
	'context/types.ts',
	'context/component-reference-types.ts',
	'context/extra-context-types.ts',
	...walk('components').filter((f) => f.endsWith('.types.ts')),
	...walk('blocks').filter((f) => f.endsWith('.types.ts')),
	'components/content-variants/extra-framework-props-types.ts',
	'functions/get-content/types.ts'
];

// Modules the type files import that are not type files themselves: only their types, by hand.
const STUBS = {
	'components/blocks/blocks-wrapper.types.ts': `import type { BuilderBlock } from '../../types/builder-block.js';
/** official components/blocks/blocks-wrapper.svelte (its \`context="module"\` type) */
export type BlocksWrapperProps = {
  blocks: BuilderBlock[] | undefined;
  parent: string | undefined;
  path: string | undefined;
  styleProp: Record<string, any> | undefined;
  /**
   * The element that wraps each list of blocks. Defaults to a \`div\` element ('ScrollView' in React Native).
   */
  BlocksWrapper: any;
  /**
   * Props to be applied to the wrapping element of blocks.
   */
  BlocksWrapperProps: any;
  children?: any;
  classNameProp?: string;
};
`,
	'blocks/personalization-container/helpers.ts': `/** official blocks/personalization-container/helpers.ts — its types only */
export type UserAttributes = {
  date?: string | Date;
  urlPath?: string;
  [key: string]: any;
};
type QueryOperator = 'is' | 'isNot' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqualTo' | 'lessThanOrEqualTo';
type QueryValue = string | number | boolean | Array<string | number | boolean>;
export type Query = {
  property: string;
  operator: QueryOperator;
  value: QueryValue;
};
`
};

const IMPORT_RE = /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g;

fs.rmSync(TO, { recursive: true, force: true });
const write = (rel, text) => {
	const out = path.join(TO, rel);
	fs.mkdirSync(path.dirname(out), { recursive: true });
	fs.writeFileSync(out, `// Vendored from @builder.io/sdk-svelte@${version} src/${rel} (MIT) by scripts/vendor-official-types.mjs — do not edit.\n${text}`);
};
for (const rel of files) {
	let text = fs.readFileSync(path.join(FROM, rel), 'utf8');
	text = text.replace(IMPORT_RE, (_m, a, spec, b) => {
		if (spec.endsWith('blocks-wrapper.svelte')) spec = spec.replace(/blocks-wrapper\.svelte$/, 'blocks-wrapper.types');
		return `${a}${spec}.js${b}`;
	});
	write(rel, text);
}
for (const [rel, text] of Object.entries(STUBS)) write(rel, text);

// every relative import must land on a vendored file
const all = new Set([...files, ...Object.keys(STUBS)]);
for (const rel of all) {
	const text = fs.readFileSync(path.join(TO, rel), 'utf8');
	for (const m of text.matchAll(IMPORT_RE)) {
		const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[2].replace(/\.js$/, '.ts')));
		if (!all.has(target)) throw new Error(`${rel} imports ${m[2]}, which is not vendored`);
	}
}
console.log(`vendored ${all.size} official type modules (v${version}) into src/lib/official/`);
