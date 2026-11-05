// content-styles.ts vs the official components/content/components/styles.helpers.ts, composed exactly as
// the official styles.svelte builds its `injectedStyles` (getCss + getFontCss + getDefaultStyles), with
// the props content.svelte passes (content.id, content.data.cssCode, content.data.customFonts).
import { describe, expect, it } from 'vitest';
import {
	getCss,
	getDefaultStyles,
	getFontCss,
	type CustomFont
} from '../../node_modules/@builder.io/sdk-svelte/src/components/content/components/styles.helpers';
import { content_styles } from '../../src/lib/internal/content-styles';
import type { BuilderContent } from '../../src/lib/types';

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

function official(content: BuilderContent | undefined, nested: boolean | undefined): string {
	const cssCode = content?.data?.cssCode;
	const contentId = content?.id;
	const customFonts = content?.data?.customFonts as CustomFont[] | undefined;
	return `
${getCss({
	cssCode: cssCode,
	contentId: contentId
})}
${getFontCss({
	customFonts: customFonts
})}
${getDefaultStyles(nested)}
`.trim();
}

const outcome = (fn: () => unknown) => {
	try {
		return { value: fn() };
	} catch (e) {
		return { threw: (e as Error).constructor.name };
	}
};

const c = (data: Record<string, unknown> | undefined, id?: string) => ({ id, data }) as BuilderContent;

const FONTS: unknown[] = [
	{ family: 'Roboto', fileUrl: 'https://f/roboto.woff2' },
	{ family: 'Roboto', kind: 'sans-serif', fileUrl: 'https://f/r.woff2' },
	{ family: 'Roboto', kind: '#000', fileUrl: 'https://f/r.woff2' }, // a kind with # is not appended
	{ family: 'Inter', files: { regular: 'https://f/i-400.woff2', '700': 'https://f/i-700.woff2', '300': 'https://f/i-300.woff2' } },
	{ family: 'Inter', fileUrl: 'https://f/main.woff2', files: { '400': 'https://f/main.woff2', '700': 'https://f/700.woff2' } }, // same url as main: skipped
	{ family: 'Odd', files: { italic: 'https://f/it.woff2', '700italic': 'x', ' 700': 'y', '1e3': 'z', '-0': 'w', '0': 'zero', NaN: 'nan', '100': '' } },
	{ family: 'NoUrl' }, // no fileUrl, no files: nothing
	{ family: 'NullUrl', fileUrl: null, files: { regular: 'https://f/fallback.woff2' } },
	{ family: 'EmptyUrl', fileUrl: '', files: { regular: 'https://f/fallback.woff2' } }, // '' is not nullish: no 400 rule
	{ kind: 'serif', fileUrl: 'https://f/nofamily.woff2' }, // family undefined -> "undefined, serif"
	{ family: '', fileUrl: 'https://f/empty.woff2' },
	{ family: 'Comma, Family', fileUrl: 'https://f/c.woff2' },
	{ family: 'Ünï 😀', fileUrl: "https://f/q'uote.woff2" },
	{ family: 'Files', files: {} },
	{ family: 'Weights', files: { '900': 'https://f/900.woff2', '100': 'https://f/100.woff2' } }
];

const TABLE: [string, BuilderContent | undefined, boolean | undefined][] = [
	['undefined content', undefined, false],
	['undefined content, nested', undefined, true],
	['no data', { id: 'x' } as BuilderContent, false],
	['empty data', c({}, 'x'), undefined],
	['css, no id', c({ cssCode: '& .a { color: red; }' }), false],
	['css with &, id', c({ cssCode: '& .a { color: red; } &:hover{} a&&b' }, 'abc'), false],
	['css with & in a string, id', c({ cssCode: '.a::after { content: "&"; }' }, 'abc'), false],
	['empty css, id', c({ cssCode: '' }, 'abc'), false],
	['css, nested', c({ cssCode: '.x{}' }, 'abc'), true],
	['whitespace css', c({ cssCode: '   \n  ' }, 'abc'), false],
	['id with quotes', c({ cssCode: '&{}' }, 'a"b'), false],
	['id with $&', c({ cssCode: '&{}' }, '$&$1'), false],
	['all fonts', c({ customFonts: FONTS }, 'abc'), false],
	['empty fonts', c({ customFonts: [] }, 'abc'), false],
	['null fonts', c({ customFonts: null }, 'abc'), false],
	['css and fonts, nested', c({ cssCode: '& p { margin: 0 }', customFonts: FONTS.slice(0, 4) }, 'abc'), true],
	['a very long css', c({ cssCode: '& .a{}'.repeat(5000) }, 'id'), false]
];

describe('content_styles vs official styles.svelte', () => {
	it.each(TABLE)('%s', (_, content, nested) => {
		expect(content_styles(content, nested as boolean)).toBe(official(content, nested));
	});

	it.each(FONTS.map((f, i) => [i, f]))('font %i on its own', (_, font) => {
		for (const nested of [true, false]) {
			const content = c({ customFonts: [font] }, 'id');
			expect(content_styles(content, nested)).toBe(official(content, nested));
		}
	});

	it('a seeded sweep of 400 contents', () => {
		const r = mulberry32(0xf0e7);
		const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
		const css_parts = ['& .a { color: red; }', '.b{}', '&&', '', ' ', '&:hover { x: y }', '/* & */', '\n'];
		for (let i = 0; i < 400; i++) {
			const data: Record<string, unknown> = {};
			if (r() < 0.7) data.cssCode = Array.from({ length: Math.floor(r() * 4) }, () => pick(css_parts)).join('');
			if (r() < 0.6) data.customFonts = Array.from({ length: Math.floor(r() * 4) }, () => pick(FONTS));
			const content = r() < 0.05 ? undefined : c(r() < 0.1 ? undefined : data, pick([undefined, '', 'abc', 'x-1']));
			const nested = r() < 0.5;
			expect(content_styles(content, nested), JSON.stringify({ content, nested })).toBe(official(content, nested));
		}
	});

	it('a null font throws in both (no silent difference)', () => {
		const content = c({ customFonts: [null] }, 'id');
		expect(outcome(() => content_styles(content, false))).toEqual(outcome(() => official(content, false)));
		expect(outcome(() => content_styles(content, false))).toEqual({ threw: 'TypeError' });
	});

	it('a non-string cssCode behaves as the official (kept without an id, throws with one)', () => {
		for (const id of [undefined, 'abc']) {
			const content = c({ cssCode: 42 }, id);
			expect(outcome(() => content_styles(content, false))).toEqual(outcome(() => official(content, false)));
		}
	});
});

describe('content_styles by hand', () => {
	it('& becomes the content scope', () => {
		expect(content_styles(c({ cssCode: '& .a{}' }, 'abc'), true)).toBe('div[builder-content-id="abc"] .a{}');
	});

	it('nested drops the default styles; not nested includes them', () => {
		expect(content_styles(undefined, true)).toBe('');
		const top = content_styles(undefined, false);
		expect(top.startsWith('.builder-button {')).toBe(true);
		expect(top).toContain('.builder-text > p:first-of-type');
	});

	it('a font with files by weight: one 400 rule from fileUrl, then each other numeric weight', () => {
		const css = content_styles(c({ customFonts: [{ family: 'F', fileUrl: 'u400', files: { '400': 'u400', '700': 'u700', bold: 'ub' } }] }, 'i'), true);
		expect(css.match(/@font-face/g)).toHaveLength(2);
		expect(css).toContain('src: local("F"), url(\'u400\') format(\'woff2\');');
		expect(css).toContain('font-weight: 700;');
		expect(css).not.toContain('ub');
	});
});
