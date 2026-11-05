// @vitest-environment happy-dom
// css.ts vs the official helpers/css.ts (createCssClass, convertStyleMapToCSSArray), functions/get-style.ts
// (svelte target: the array joined by ' '), functions/camel-to-kebab-case.ts and the `stringifyStyles`
// helper the official Svelte blocks carry (taken from their source below, not retyped).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { camelToKebabCase } from '../../node_modules/@builder.io/sdk-svelte/src/functions/camel-to-kebab-case';
import { convertStyleMapToCSSArray, createCssClass } from '../../node_modules/@builder.io/sdk-svelte/src/helpers/css';
import { mapStyleObjToStrIfNeeded } from '../../node_modules/@builder.io/sdk-svelte/src/functions/get-style';
import { css_class, css_safe, kebab, stringify_styles, style_attr } from '../../src/lib/internal/css';

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const OFFICIAL_SRC = resolve(process.cwd(), 'node_modules/@builder.io/sdk-svelte/src');
const STRINGIFY_FILES = [
	'blocks/BaseText.svelte',
	'blocks/accordion/accordion.svelte',
	'blocks/columns/columns.svelte',
	'blocks/image/image.svelte',
	'blocks/img/img.svelte',
	'blocks/section/section.svelte',
	'blocks/slot/slot.svelte',
	'blocks/tabs/tabs.svelte',
	'blocks/text/text.svelte',
	'blocks/video/video.svelte',
	'components/blocks/blocks-wrapper.svelte'
];
const STRINGIFY_RE = /function stringifyStyles\(stylesObj\) \{[\s\S]*?return styles;\s*\}/;
const stringify_sources = STRINGIFY_FILES.map((f) => readFileSync(resolve(OFFICIAL_SRC, f), 'utf8').match(STRINGIFY_RE)?.[0]);
const officialStringifyStyles = new Function(`return ${stringify_sources[0]}`)() as (o: unknown) => string;

const KEYS = [
	'color',
	'backgroundColor',
	'marginTop',
	'WebkitTransition',
	'msFlex',
	'MozAppearance',
	'--customVar',
	'--my-Var',
	'gridArea2',
	'aBC',
	'ABC',
	'x1Y2',
	'border-top-Width',
	'_privateKey',
	'',
	'ünicodeKey',
	'emoji😀Key',
	'__proto__x',
	'constructor',
	'toString'
];
const VALUES: unknown[] = [
	'red',
	'',
	' 10px ',
	'url("a.png")',
	'</style><script>alert(1)</script>',
	'a</STYLE >b',
	'</sTyLe',
	'</script>',
	'</',
	'<\\/style',
	'calc(100% - 10px) !important',
	'"quoted"',
	'line\nbreak',
	'x'.repeat(5000),
	'日本語',
	0,
	12,
	NaN,
	Infinity,
	true,
	false,
	null,
	undefined,
	{ nested: 'x' },
	['a'],
	() => 'fn'
];

function random_styles(r: () => number, keys = KEYS): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (let n = Math.floor(r() * 7); n > 0; n--) out[keys[Math.floor(r() * keys.length)]] = VALUES[Math.floor(r() * VALUES.length)];
	return out;
}

const ASCII_KEYS = KEYS.filter((k) => /^[\x00-\x7f]*$/.test(k));

describe('kebab vs official camelToKebabCase', () => {
	it.each(ASCII_KEYS)('%s', (key) => {
		expect(kebab(key)).toBe(camelToKebabCase(key));
	});

	it('a seeded sweep of 500 ASCII keys', () => {
		const r = mulberry32(42);
		const chars = 'abcXYZ019-_$ ';
		for (let i = 0; i < 500; i++) {
			let key = '';
			for (let n = Math.floor(r() * 12); n > 0; n--) key += chars[Math.floor(r() * chars.length)];
			expect(kebab(key), key).toBe(camelToKebabCase(key));
		}
	});

	it('is memoised and stable', () => {
		expect(kebab('borderTopLeftRadius')).toBe('border-top-left-radius');
		expect(kebab('borderTopLeftRadius')).toBe('border-top-left-radius');
		expect(kebab('')).toBe('');
	});

	// The svelte stringifyStyles lowercases only the A-Z letters it dashes, as kebab does. The official
	// camelToKebabCase lowercases the whole key, so a non-ASCII uppercase letter differs there.
	it('non-ASCII uppercase is left as is (matches stringifyStyles, not camelToKebabCase)', () => {
		expect(kebab('colorÉclat')).toBe('colorÉclat');
		expect(officialStringifyStyles({ colorÉclat: 'x' })).toBe('colorÉclat:x;');
		expect(camelToKebabCase('colorÉclat')).toBe('coloréclat');
	});
});

describe('css_class vs official createCssClass', () => {
	const official = (class_name: string, styles: Record<string, unknown>, media?: string) =>
		createCssClass({ className: class_name, styles: styles as Partial<CSSStyleDeclaration>, mediaQuery: media });

	it('a plain rule, byte for byte', () => {
		const styles = { color: 'red', marginTop: '10px', zIndex: 3, display: undefined };
		expect(css_class('builder-abc', styles)).toBe(official('builder-abc', styles));
		expect(css_class('builder-abc', styles)).toBe('.builder-abc {\n    color: red;\nmargin-top: 10px;\n  }');
	});

	it('with a media query, byte for byte', () => {
		const media = '@media (max-width: 991px)';
		const styles = { backgroundColor: 'blue' };
		expect(css_class('b', styles, media)).toBe(official('b', styles, media));
		expect(css_class('b', styles, media)).toBe('@media (max-width: 991px) {\n      .b {\n    background-color: blue;\n  }\n    }');
	});

	it('empty styles, only non-string values, empty class name, empty media query', () => {
		for (const styles of [{}, { a: 1, b: null, c: undefined, d: {} }]) {
			expect(css_class('x', styles)).toBe(official('x', styles));
			expect(css_class('', styles)).toBe(official('', styles));
			expect(css_class('x', styles, '')).toBe(official('x', styles, ''));
		}
	});

	it('a hover class name (as block styles build it)', () => {
		const styles = { transform: 'scale(1.1)', transition: 'all 0.5s ease-in-out', transitionDelay: '0s' };
		expect(css_class('builder-1:hover', styles)).toBe(official('builder-1:hover', styles));
	});

	it('a seeded sweep of 500 rules: ours === css_safe(official)', () => {
		const r = mulberry32(0xc55);
		const names = ['builder-1', 'b:hover', 'a</style>', 'x y', '', 'ünï', 'builder-</STYLE'];
		const medias = [undefined, '', '@media (max-width: 320px)', '@media (max-width: 991px)', '@media print'];
		for (let i = 0; i < 500; i++) {
			const name = names[Math.floor(r() * names.length)];
			const styles = random_styles(r, ASCII_KEYS);
			const media = medias[Math.floor(r() * medias.length)];
			expect(css_class(name, styles, media), JSON.stringify({ name, styles, media })).toBe(css_safe(official(name, styles, media)));
		}
	});

	it('a value or class name that would close the style tag is written safe', () => {
		const out = css_class('a</style><b>', { color: 'red</style><img src=x onerror=alert(1)>' });
		expect(out).not.toMatch(/<\/style/i);
		expect(out).toContain('<\\/style><img');
		expect(out).toContain('.a<\\/style><b> {');
	});

	it('inside a real style tag: one style element, no injected markup', () => {
		const css = css_class('builder-1', { color: 'red</style><img id="pwn" src=x>', marginTop: '1px' });
		document.body.innerHTML = `<style>${css}</style><p id="after">after</p>`;
		expect(document.querySelectorAll('style')).toHaveLength(1);
		expect(document.getElementById('pwn')).toBeNull();
		expect(document.getElementById('after')).not.toBeNull();
		expect(document.querySelector('style')!.textContent).toBe(css);
		document.body.innerHTML = '';
	});

	// BUG (minor): css_class and style_attr dash keys with `kebab`, which (like the svelte stringifyStyles)
	// lowercases only A-Z. The official createCssClass / getStyle use camelToKebabCase, which lowercases
	// the whole key, so a key with a non-ASCII uppercase letter (a custom property `--colorÉ`, case
	// sensitive in CSS) is written differently.
	it.fails('a key with a non-ASCII uppercase letter, as the official', () => {
		const styles = { '--brandÉclat': 'red', colorΣ: 'blue' };
		expect(css_class('b', styles)).toBe(official('b', styles));
		expect(style_attr(styles)).toBe(convertStyleMapToCSSArray(styles as Partial<CSSStyleDeclaration>).join(' '));
	});

	// BUG: css_class makes the class name and every value safe, but not the media query. The media query
	// is `@media (max-width: ${breakpoint}px)` with the breakpoint taken from content.meta.breakpoints
	// unchecked (breakpoints.ts copies it as is), so a string breakpoint such as
	// `</style><script>…</script>` ends the block style tag and injects markup.
	it.fails('a media query that would close the style tag is written safe', () => {
		const out = css_class('b', { color: 'red' }, '@media (max-width: </style><script>alert(1)</script>px)');
		expect(out).not.toMatch(/<\/style/i);
	});
});

describe('style_attr vs official getStyle (svelte target)', () => {
	const official = (style: Record<string, unknown>) => convertStyleMapToCSSArray(style as Partial<CSSStyleDeclaration>).join(' ');

	it('mapStyleObjToStrIfNeeded is the array joined by a space for svelte', () => {
		expect(mapStyleObjToStrIfNeeded({ color: 'red', marginTop: '1px' })).toBe(official({ color: 'red', marginTop: '1px' }));
	});

	it('a few by hand', () => {
		expect(style_attr({ color: 'red', marginTop: '1px', zIndex: 3 })).toBe('color: red; margin-top: 1px;');
		expect(style_attr({})).toBe('');
		expect(style_attr(undefined)).toBe('');
		expect(style_attr({ a: 1 })).toBe(official({ a: 1 }));
	});

	it('a seeded sweep of 500 style maps', () => {
		const r = mulberry32(99);
		for (let i = 0; i < 500; i++) {
			const style = random_styles(r, ASCII_KEYS);
			expect(style_attr(style), JSON.stringify(style)).toBe(official(style));
		}
	});

	it('a `</style` value is kept as is (an attribute is escaped by svelte, not a style tag)', () => {
		expect(style_attr({ color: 'a</style>' })).toBe('color: a</style>;');
	});
});

describe('stringify_styles vs the official svelte stringifyStyles', () => {
	it('every official Svelte block carries the same helper', () => {
		expect(stringify_sources.every(Boolean)).toBe(true);
		const norm = (s: string) => s.replace(/\s+/g, ' ');
		for (const src of stringify_sources) expect(norm(src!)).toBe(norm(stringify_sources[0]!));
	});

	it('a few by hand', () => {
		expect(stringify_styles({ '--flex-dir': 'column', marginLeft: 0, x: null, y: undefined })).toBe('--flex-dir:column;margin-left:0;x:null;y:undefined;');
		expect(stringify_styles(undefined)).toBe('');
		expect(stringify_styles({})).toBe('');
	});

	it('undefined / null / empty match', () => {
		for (const v of [undefined, null, {}]) expect(stringify_styles(v as Record<string, unknown> | undefined)).toBe(officialStringifyStyles(v));
	});

	it('a seeded sweep of 500 maps (any value type, unicode keys)', () => {
		const r = mulberry32(1234);
		for (let i = 0; i < 500; i++) {
			const style = random_styles(r);
			expect(stringify_styles(style)).toBe(officialStringifyStyles(style));
		}
	});
});

describe('css_safe', () => {
	it('escapes every `</style`, any case, and nothing else', () => {
		expect(css_safe('a</style>b</STYLE>c</StYlE')).toBe('a<\\/style>b<\\/STYLE>c<\\/StYlE');
		expect(css_safe('</script></div></')).toBe('</script></div></');
		expect(css_safe('</styles')).toBe('<\\/styles');
		expect(css_safe('')).toBe('');
		expect(css_safe('plain { color: red; }')).toBe('plain { color: red; }');
	});

	it('returns the same string when there is no `</`', () => {
		const s = 'x'.repeat(10000);
		expect(css_safe(s)).toBe(s);
	});

	it('is idempotent', () => {
		const once = css_safe('a</style></style>');
		expect(css_safe(once)).toBe(once);
	});

	it('a long string with many closers', () => {
		const s = '</style>'.repeat(1000);
		expect(css_safe(s)).toBe('<\\/style>'.repeat(1000));
	});
});
