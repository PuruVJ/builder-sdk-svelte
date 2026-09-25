// Generated fixtures:
//   fixtures/gen    — a size ladder of production-shaped pages (synthetic), shape variants, and small
//                     feature fixtures that exercise every render path (for the equivalence test);
//                     plus, when captured pages exist locally in fixtures/real, a ladder from those.
//   fixtures/pages  — synthetic whole pages (body + footer + small roots) for the app-shaped bench.
//   node scripts/gen-fixtures.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'fixtures/gen');
fs.mkdirSync(OUT, { recursive: true });
const E = '@builder.io/sdk:Element';

// Seeded PRNG (mulberry32) — reproducible fixtures.
let seed = 0x9e3779b9;
const rand = () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let uid = 0;
const id = () => 'builder-' + (++uid).toString(16).padStart(8, '0') + Math.floor(rand() * 1e12).toString(16);
const write = (name, obj) => {
	const file = path.join(OUT, name);
	fs.writeFileSync(file, JSON.stringify(obj));
	return fs.statSync(file).size;
};
const content = (blocks, extra = {}) => ({ id: 'content-' + id(), name: 'gen', data: { blocks, ...extra.data }, ...extra, data_: undefined });

/** Re-id every element in a deep copy (so repeated real blocks stay unique ids, like real content). */
function reid(v) {
	if (Array.isArray(v)) return v.map(reid);
	if (!v || typeof v !== 'object') return v;
	const out = {};
	for (const k in v) out[k] = reid(v[k]);
	if (out['@type'] === E) out.id = id();
	return out;
}

const text = (t, extra = {}) => ({
	'@type': E,
	'@version': 2,
	id: id(),
	component: { name: 'Text', options: { text: `<p>${t}</p>` } },
	responsiveStyles: { large: { display: 'flex', flexDirection: 'column', marginTop: '20px' }, small: { marginTop: '10px' } },
	...extra
});
const box = (children, extra = {}) => ({
	'@type': E,
	'@version': 2,
	id: id(),
	children,
	responsiveStyles: { large: { display: 'flex', position: 'relative', flexDirection: 'column' } },
	...extra
});

// ── 1. production-shaped blocks (synthetic) ───────────────────────────────────────────────────
// The shape real marketing pages have: a handful of custom-component blocks, each carrying LARGE
// options (card groups, slides, CTA objects, editor snapshots of the same data, translation
// metadata), occasional option arrays of nested blocks, tracking-pixel images, and one
// personalization container whose variants hold more blocks.
const words = 'energy digital solution building industry data power smart grid automation efficient sustainable management secure'.split(' ');
const phrase = (n) => Array.from({ length: n }, () => words[Math.floor(rand() * words.length)]).join(' ');
const link = () => ({ href: `/${phrase(2).replace(/ /g, '-')}`, target: rand() < 0.2 ? '_blank' : '_self', label: phrase(3) });
const media = () => ({
	mediaType: 'image',
	image: `https://cdn.builder.io/api/v1/image/assets%2F${id()}`,
	alt: phrase(4),
	width: 1200,
	height: 675,
	focalPoint: { x: rand(), y: rand() },
	renditions: Array.from({ length: 4 }, (_, i) => ({ width: 320 * (i + 1), url: `https://cdn.builder.io/api/v1/image/assets%2F${id()}?width=${320 * (i + 1)}` }))
});
const card = () => ({ title: phrase(4), description: phrase(28), cardLink: link(), media: media(), tags: [phrase(1), phrase(1)], analytics: { id: id(), category: phrase(2) } });
function custom_block(kind, weight) {
	const cards = Array.from({ length: weight }, card);
	const options = {
		componentVersion: '4.2.0',
		shouldTranslate: true,
		theme: rand() < 0.5 ? 'light' : 'dark',
		componentTitle: phrase(5),
		description: phrase(40),
		ctaFirst: link(),
		ctaSecond: link(),
		cardGroup: cards,
		// editors keep a snapshot of the same data next to it (doubles the options, like real content)
		cardGroup_childSnapshot: JSON.parse(JSON.stringify(cards)),
		ComponentStyles: { paddingTop: '24px', paddingBottom: '24px' },
		id: id()
	};
	if (rand() < 0.25) options.presentationBlocks = [text(phrase(6)), text(phrase(9))];
	return {
		'@type': E,
		'@version': 2,
		id: id(),
		meta: { nonTranslatableInputs: Array.from({ length: 30 }, () => `cardGroup.*.${phrase(1)}.${phrase(1)}`) },
		component: { name: kind, options },
		responsiveStyles: rand() < 0.7 ? { large: { display: 'flex', flexDirection: 'column', position: 'relative' } } : undefined
	};
}
const KINDS = ['Hero Carousel', 'Product Block', 'Promo Block', 'Card Grid', 'Link List', 'Feature Menu', 'CTA Banner'];
const pixel = () => ({
	'@type': E,
	id: 'builder-pixel-' + id(),
	tagName: 'img',
	properties: { src: 'https://cdn.builder.io/api/v1/pixel?apiKey=0000', 'aria-hidden': 'true', alt: '', role: 'presentation', width: '0', height: '0' },
	responsiveStyles: { large: { height: '0', width: '0', display: 'block', opacity: '0', overflow: 'hidden', pointerEvents: 'none' } }
});
const personalization = () => ({
	'@type': E,
	id: id(),
	component: {
		name: 'PersonalizationContainer',
		options: {
			variants: [
				{ query: [{ property: 'segment', operator: 'is', value: 'pro' }], startDate: null, endDate: null, blocks: [custom_block('Hero Carousel', 6)] },
				{ query: [{ property: 'segment', operator: 'is', value: 'home' }], startDate: null, endDate: null, blocks: [custom_block('Hero Carousel', 6)] }
			],
			previewingIndex: null
		}
	},
	children: [custom_block('Hero Carousel', 6)]
});
/** One production-shaped page body of about `target` bytes. */
function page_blocks(target) {
	const blocks = [personalization()];
	let size = JSON.stringify(blocks[0]).length;
	while (size < target) {
		const b = rand() < 0.1 ? pixel() : custom_block(KINDS[Math.floor(rand() * KINDS.length)], 4 + Math.floor(rand() * 18));
		blocks.push(b);
		size += JSON.stringify(b).length;
	}
	blocks.push(pixel());
	return blocks;
}

// ── 1a. size ladder: production-shaped pages ──────────────────────────────────────────────────
const LADDER = [['50k', 50e3], ['250k', 250e3], ['500k', 500e3], ['1m', 1e6], ['2m', 2e6], ['4m', 4e6]];
for (const [label, target] of LADDER) {
	const name = (target > 1e6 ? 'big-' : '') + `page-${label}.json`;
	const blocks = page_blocks(target);
	console.log(name, write(name, content(blocks)), 'bytes,', blocks.length, 'top-level blocks');
}

// ── 1b. whole pages for the app-shaped bench (fixtures/pages/<page>.<root>.json) ──────────────
{
	const dir = path.join(ROOT, 'fixtures/pages');
	fs.mkdirSync(dir, { recursive: true });
	const root = (blocks) => ({ id: id(), name: 'gen', data: { blocks: [...blocks, pixel()] } });
	for (const [name, target] of [['landing-small', 90e3], ['landing', 250e3], ['landing-large', 450e3]]) {
		const put = (kind, obj) => fs.writeFileSync(path.join(dir, `${name}.${kind}.json`), JSON.stringify(obj));
		put('pageContent', content(page_blocks(target)));
		put('accessibilityContent', root([custom_block('Accessibility Toggle', 0)]));
		put('content', root([custom_block('Support Module', 1)]));
		put('getFooterContent', root([custom_block('Content - Footer', 10)]));
		console.log('page', name);
	}
}

// ── 1c. (local only) a ladder from captured pages in fixtures/real, when present ──────────────
const real_dir = path.join(ROOT, 'fixtures/real');
if (fs.existsSync(real_dir)) {
	const real_blocks = [];
	for (const f of fs.readdirSync(real_dir).filter((f) => f.endsWith('.pageContent.json')).sort())
		real_blocks.push(...JSON.parse(fs.readFileSync(path.join(real_dir, f), 'utf8')).data.blocks);
	if (real_blocks.length)
		for (const [label, target] of LADDER) {
			const blocks = [];
			let size = 0;
			for (let i = 0; size < target; i++) {
				const b = reid(real_blocks[i % real_blocks.length]);
				blocks.push(b);
				size += JSON.stringify(b).length;
			}
			const name = (target > 1e6 ? 'big-' : '') + `real-${label}.json`;
			console.log(name, write(name, content(blocks)), 'bytes,', blocks.length, 'top-level blocks');
		}
}

// ── 2. shape variants ─────────────────────────────────────────────────────────────────────────
for (const n of [100, 1000, 5000]) {
	const blocks = Array.from({ length: n }, (_, i) => text(`Paragraph ${i} ` + 'lorem ipsum '.repeat(8)));
	console.log(`flat-${n}`, write(`${n > 1000 ? 'big-' : ''}flat-${n}.json`, content(blocks)));
}
for (const depth of [10, 50, 200]) {
	let node = text('leaf');
	for (let d = 0; d < depth; d++) node = box([node, text(`level ${d}`)]);
	console.log(`deep-${depth}`, write(`deep-${depth}.json`, content([node])));
}
{
	// A few blocks, each carrying huge options (the real home-page shape, pushed further).
	const huge_options = () => ({
		items: Array.from({ length: 400 }, (_, i) => ({
			title: 'Item ' + i,
			description: 'lorem ipsum dolor sit amet '.repeat(6),
			image: `https://cdn.builder.io/api/v1/image/assets%2Fx%2F${i}`,
			link: { href: `/p/${i}`, target: '_self' },
			tags: ['a', 'b', 'c']
		}))
	});
	const blocks = Array.from({ length: 12 }, () => ({ '@type': E, id: id(), component: { name: 'Gen - Carousel', options: huge_options() } }));
	console.log('wide-options', write('big-wide-options.json', content(blocks)));
}

// ── 3. feature fixtures (small; equivalence) ──────────────────────────────────────────────────
const feat = (name, blocks, extra) => write(`feat-${name}.json`, extra ? { content: content(blocks, extra.content), ...extra.props } : content(blocks));

feat('bindings', [
	text('static', { bindings: { 'component.options.text': 'state.title' } }),
	text('href', { bindings: { 'properties.href': 'state.link' } }),
	text('styles', { bindings: { 'responsiveStyles.large.color': 'state.color', 'style.fontSize': '"12px"' } }),
	text('hidden', { bindings: { hide: 'state.flag' } }),
	text('shown', { bindings: { show: '!state.flag' } }),
	text('multi', { bindings: { 'component.options.text': 'var x = state.count * 2; return "<b>" + x + "</b>"' } })
], { content: { data: { state: { title: '<p>From state</p>', link: '/go', color: 'red', flag: true, count: 21 } } } });

feat('text-templates', [
	text('Hello {{state.name}}, you have {{state.count + 1}} items {{ state.missing }}'),
	text('No template here')
], { content: { data: { state: { name: 'Ada', count: 2 } } } });

feat('repeat', [
	box([text('x', { bindings: { 'component.options.text': 'state.product.name + " #" + state.$index' } })], {
		repeat: { collection: 'state.products', itemName: 'product' }
	}),
	box([text('y', { bindings: { 'component.options.text': 'state.tagsItem' } })], { repeat: { collection: 'state.tags' } }),
	box([text('never')], { repeat: { collection: 'state.nothing' } })
], { content: { data: { state: { products: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], tags: ['t1', 't2'] } } } });

const loc = (en, fr) => ({ '@type': '@builder.io/core:LocalizedValue', Default: en, 'en-US': en, 'fr-FR': fr });
const localized_blocks = [
	{ '@type': E, id: id(), component: { name: 'Text', options: { text: loc('<p>Hello</p>', '<p>Bonjour</p>') } } },
	{ '@type': E, id: id(), component: { name: 'Gen - Card', options: { title: loc('Title', 'Titre'), nested: { deep: loc('d', 'p') } } } }
];
feat('localized-fr', localized_blocks, { props: { locale: 'fr-FR' }, content: {} });
feat('localized-default', localized_blocks);

feat('elements', [
	box([text('in link')], { tagName: 'a', properties: { href: '/somewhere', target: '_blank' } }),
	box([text('prop href')], { properties: { href: '/x', 'data-x': 'y', class: 'from-props' }, class: 'from-block' }),
	{ '@type': E, id: id(), tagName: 'img', properties: { src: '/i.png', alt: 'i' } },
	box([text('section tag')], { tagName: 'section', style: { backgroundColor: 'red', marginTop: '4px' } }),
	box([text('hidden')], { hide: true }),
	box([text('show false')], { show: false }),
	box([text('actions')], { actions: { click: 'state.clicked = true', mouseEnter: 'console.log(1)' } }),
	box([text('hover')], {
		animations: [{ trigger: 'hover', duration: 0.3, delay: 0.1, easing: 'easeInOut', steps: [{ styles: {} }, { styles: { opacity: '0.5' } }] }]
	})
]);

feat('breakpoints-css', [text('bp', { responsiveStyles: { large: { color: 'red' }, medium: { color: 'blue' }, small: { color: 'green' }, xsmall: { color: 'pink' } } })], {
	content: {
		meta: { breakpoints: { xsmall: 400, small: 700, medium: 1100 } },
		data: {
			cssCode: '& .x { color: red; } .y & { margin: 0 }',
			customFonts: [{ family: 'Inter', kind: 'sans-serif', fileUrl: 'https://f/inter.woff2', files: { regular: 'https://f/r.woff2', 700: 'https://f/b.woff2', italic: 'https://f/i.woff2' } }],
			inputs: [{ name: 'greeting', defaultValue: 'hi' }],
			jsCode: 'state.fromJs = "js-" + state.greeting;'
		}
	}
});
feat('js-state', [text('j', { bindings: { 'component.options.text': 'state.fromJs' } })], {
	content: { data: { inputs: [{ name: 'greeting', defaultValue: 'hi' }], jsCode: 'state.fromJs = "js-" + state.greeting;' } }
});

feat('columns', [
	{
		'@type': E,
		id: id(),
		component: {
			name: 'Columns',
			options: {
				space: 12,
				stackColumnsAt: 'mobile',
				columns: [
					{ blocks: [text('c1')], width: 30 },
					{ blocks: [text('c2'), { '@type': E, id: id(), component: { name: 'Columns', options: { columns: [{ blocks: [text('n1')] }, { blocks: [text('n2')], link: '/l' }] } } }] }
				]
			}
		}
	}
]);

feat('symbol-inline', [
	{
		'@type': E,
		id: id(),
		component: {
			name: 'Symbol',
			options: {
				symbol: {
					model: 'symbol',
					entry: 'sym1',
					data: { who: 'symbol-data' },
					content: { id: 'sym1', data: { blocks: [text('in symbol', { bindings: { 'component.options.text': 'state.who' } })] } }
				}
			}
		}
	}
]);

feat('builtins', [
	{ '@type': E, id: id(), component: { name: 'Image', options: { image: 'https://cdn.builder.io/api/v1/image/assets%2Fabc%2Fdef?width=300', aspectRatio: 0.5, altText: 'alt' } } },
	{ '@type': E, id: id(), component: { name: 'Core:Button', options: { text: 'Go', link: '/go', openLinkInNewTab: true } } },
	{ '@type': E, id: id(), component: { name: 'Core:Button', options: { text: 'Btn' } } },
	{ '@type': E, id: id(), component: { name: 'Core:Section', options: { maxWidth: 900 } }, children: [text('in section')] },
	{ '@type': E, id: id(), component: { name: 'Fragment' }, children: [text('in fragment')] },
	{ '@type': E, id: id(), component: { name: 'Custom Code', options: { code: '<div class="cc">code</div>' } } },
	{ '@type': E, id: id(), component: { name: 'Embed', options: { content: '<iframe src="about:blank"></iframe>' } } },
	{ '@type': E, id: id(), component: { name: 'Raw:Img', options: { image: 'https://cdn.builder.io/x.png' } } }
]);
console.log('feature fixtures written');
