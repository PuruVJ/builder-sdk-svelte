// tags.ts vs the official markup: every official style tag is components/inlined-styles.svelte
// (`<style  data-id=${id}  nonce=${nonce}  >${styles}</style>`), used by components/content/components/
// styles.svelte (id builderio-content), block/components/block-styles.svelte (builderio-block),
// blocks/columns/columns.svelte (builderio-columns) and personalization-container.svelte
// (variants-styles-<block id>). The official component is rendered here, not retyped.
import { Window } from 'happy-dom';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import InlinedStyles from '../../node_modules/@builder.io/sdk-svelte/src/components/inlined-styles.svelte';
import { css_safe } from '../../src/lib/internal/css';
import { block_style, blocks_sheet, columns_style, content_style, variants_style } from '../../src/lib/internal/tags';

/** The official InlinedStyles' HTML (svelte's hydration comments dropped). */
function official(id: string, styles: string, nonce: string | undefined): string {
	return render(InlinedStyles, { props: { id, styles, nonce } }).body.replace(/<!--[\s\S]*?-->/g, '');
}

// (a node environment: svelte/server renders the official component; happy-dom only parses)
const document = new Window().document;

/** What an HTML parser makes of it: every element's tag, attributes and text. */
function parsed(html: string) {
	const div = document.createElement('div');
	div.innerHTML = html;
	return [...div.querySelectorAll('*')].map((el) => ({
		tag: el.tagName,
		attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])),
		text: el.textContent
	}));
}

const CSS = ['', '.a { color: red; }', '@media (max-width: 991px) {\n  .b { margin: 0; }\n}', '.x::after { content: "</div>"; }', 'ünïcode { content: "😀"; }'];
// (a base64 nonce ending `==` parses wrong in happy-dom when unquoted, as the official writes it — a
// browser keeps the `=`: it is checked by text below)
const NONCES = [undefined, '', 'abc123', 'r4nd0m+Q'];

describe('block_style', () => {
	it.each(NONCES.map((n) => [String(n), n]))('parses as the official block style tag (nonce %s)', (_, nonce) => {
		for (const css of CSS) expect(parsed(block_style(nonce, css))).toEqual(parsed(official('builderio-block', css, nonce)));
	});

	it('the exact text', () => {
		expect(block_style('r4nd0m+/==', '')).toBe('<style data-id="builderio-block" nonce="r4nd0m+/=="></style>');
		expect(block_style('n', '.a{}')).toBe('<style data-id="builderio-block" nonce="n">.a{}</style>');
		// (an undefined nonce is written as the official writes it: the text "undefined")
		expect(block_style(undefined, '')).toBe('<style data-id="builderio-block" nonce="undefined"></style>');
	});

	it('writes the css as given (block rules are made safe when built, in css.ts)', () => {
		expect(block_style('', 'a</style>')).toBe('<style data-id="builderio-block" nonce="">a</style></style>');
	});
});

describe('content_style', () => {
	it.each(NONCES.map((n) => [String(n), n]))('parses as the official content style tag (nonce %s)', (_, nonce) => {
		for (const css of CSS) expect(parsed(content_style(nonce, css))).toEqual(parsed(official('builderio-content', css, nonce)));
	});

	it('makes the css safe: a `</style` in content CSS cannot end the tag', () => {
		const css = '.a { color: red; } </style><img id="pwn" src=x onerror="alert(1)"><style>';
		const html = content_style('', css);
		expect(html).toBe(`<style data-id="builderio-content" nonce="">${css_safe(css)}</style>`);
		const els = parsed(html);
		expect(els).toHaveLength(1);
		expect(els[0].tag).toBe('STYLE');
		// the official markup lets it end the tag
		expect(parsed(official('builderio-content', css, '')).map((e) => e.tag)).toContain('IMG');
	});
});

describe('blocks_sheet', () => {
	it('one style tag, data-id builderio-blocks, css as given', () => {
		expect(blocks_sheet('n', '.a{} .b{}')).toBe('<style data-id="builderio-blocks" nonce="n">.a{} .b{}</style>');
		expect(blocks_sheet(undefined, '')).toBe('<style data-id="builderio-blocks" nonce="undefined"></style>');
		expect(parsed(blocks_sheet('n', CSS[2]))).toEqual([{ tag: 'STYLE', attrs: { 'data-id': 'builderio-blocks', nonce: 'n' }, text: CSS[2] }]);
	});
});

describe('columns_style', () => {
	it.each(NONCES.filter((n) => n !== undefined).map((n) => [n, n]))('parses as the official columns style tag (nonce %s)', (_, nonce) => {
		for (const css of CSS) expect(parsed(columns_style(nonce, css))).toEqual(parsed(official('builderio-columns', css, nonce)));
	});

	// The official context nonce is always a string (`nonce || ''`); an undefined one is written empty.
	it('an undefined nonce is written empty', () => {
		expect(columns_style(undefined, '')).toBe('<style data-id="builderio-columns" nonce=""></style>');
	});

	it('makes the css safe', () => {
		const html = columns_style('', '.c-breakpoints{} </STYLE><b>x</b>');
		expect(html).not.toMatch(/<\/style>[^]*<\/style>/i);
		expect(parsed(html)).toHaveLength(1);
	});
});

describe('variants_style', () => {
	it('byte for byte the official personalization container tag (nonce `|| ""`)', () => {
		for (const id of ['builder-1', 'abc', undefined]) {
			for (const nonce of ['', 'n0nce']) {
				for (const css of CSS) {
					if (css.includes('</')) continue;
					expect(variants_style(id, nonce, css)).toBe(official(`variants-styles-${id}`, css, nonce));
				}
			}
		}
	});

	it('the exact text, official double spacing kept', () => {
		expect(variants_style('b1', 'n', 'x')).toBe('<style  data-id=variants-styles-b1  nonce=n  >x</style>');
		expect(variants_style(undefined, undefined, '')).toBe('<style  data-id=variants-styles-undefined  nonce=undefined  ></style>');
	});

	it('makes the css safe (the official does not)', () => {
		const css = 'div[data-variant-id="x</style><img src=x>-0"] { display: none !important; } ';
		expect(variants_style('b', '', css)).toBe(`<style  data-id=variants-styles-b  nonce=  >${css_safe(css)}</style>`);
		expect(parsed(variants_style('b', '', css))).toHaveLength(1);
	});

	// Regression (official bug, not copied): the block id went into the unquoted `data-id` attribute as
	// is: an id from content such as `x></style><img …><style` ended the tag and injected markup.
	// A character that would end the attribute is dropped; a plain id is written as the official.
	it('a block id cannot end the tag', () => {
		const html = variants_style('x></style><img id=pwn src=x><style', '', '');
		expect(parsed(html).map((e) => e.tag)).toEqual(['STYLE']);
	});
});
