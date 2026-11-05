/**
 * A seeded random Builder content generator for the render-parity fuzz test (tests/fuzz.test.ts).
 *
 * `generate(seed)` gives `{ content, data?, locale? }` — the render props of one random page: block
 * trees mixing every built-in, unknown names, the bench stand-in custom components, tag / attribute /
 * style variety, responsive styles at every breakpoint, show/hide, bindings, repeats, actions,
 * animations, localized values, content state / inputs / jsCode / cssCode / fonts, deep chains, wide
 * lists, duplicate and missing ids, nulls in odd places and hostile strings. Values are JSON only,
 * so a spec round-trips through JSON.stringify (that is how a failure is printed and reproduced).
 */

const E = '@builder.io/sdk:Element';
const LOC = '@builder.io/core:LocalizedValue';

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Obj = { [k: string]: Json };
export interface Spec {
	content: Obj;
	data?: Obj;
	locale?: string;
}

/** Names the bench's components_for registers as stand-ins (any name not built in becomes one). */
export const CUSTOM_NAMES = ['Fuzz Card', 'Fuzz Container', 'Fuzz:List'];
const UNKNOWN_NAMES = ['Not Registered', 'Core:Nope', 'text', ''];

export function rng(seed: number) {
	let s = seed | 0 || 0x9e3779b9;
	const next = () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const int = (n: number) => Math.floor(next() * n);
	const pick = <T>(arr: readonly T[]): T => arr[int(arr.length)];
	const chance = (p: number) => next() < p;
	return { next, int, pick, chance };
}
type Rng = ReturnType<typeof rng>;

const WEIRD = [
	'plain',
	'a "double" and \'single\' quote',
	'<b>bold</b> & <i>it</i>',
	'&amp; &lt; &#39; &',
	'</script><script>window.x=1</script>',
	'héllo wörld ✓ 𝄞 中文 🎉',
	'  spaced   out  ',
	'',
	' ',
	'line\nbreak\ttab',
	'  ',
	'{{state.title}}',
	'{{ state.n + 1 }} items',
	'`back${tick}`',
	'<p>para</p><p>two</p>',
	'<!-- comment --> after',
	'0',
	'null',
	'undefined'
] as const;

const COLORS = ['red', 'blue', 'rgba(0, 0, 0, 0.5)', '#fff', 'var(--x)', 'inherit'];
const STYLE_KEYS = ['color', 'marginTop', 'display', 'fontSize', 'backgroundColor', 'paddingLeft', 'flexDirection', 'position', 'width', 'opacity'];
const STYLE_VALUES = ['10px', 'flex', 'none', 'column', 'relative', '50%', 'auto', '1', '0', '', 'calc(100% - 4px)', 'url("a.png")'];
const TAGS = ['div', 'div', 'div', 'a', 'span', 'img', 'input', 'svg', 'section', 'p', 'button', 'ul', 'li', 'h1', 'br', 'textarea', 'custom-el', 'Span', 'DIV', 'my-elem'];

export function generate(seed: number): Spec {
	const r = rng(seed);
	let uid = 0;
	const ids: string[] = [];
	const id = (): Json | undefined => {
		if (ids.length && r.chance(0.04)) return r.pick(ids); // duplicate id
		if (r.chance(0.04)) return undefined; // missing id
		const v = 'builder-' + (seed >>> 0).toString(16) + '-' + (++uid).toString(16);
		ids.push(v);
		return v;
	};
	const weird = () => r.pick(WEIRD);
	const loc = (v: Json): Json => ({ '@type': LOC, Default: v, 'en-US': v, 'fr-FR': typeof v === 'string' ? 'fr:' + v : v });
	const maybe_loc = (v: Json): Json => (r.chance(0.12) ? loc(v) : v);
	const html_text = (): Json => {
		const t = weird();
		if (r.chance(0.2)) return `<p>Hi {{state.title}} #{{state.n}}</p>`;
		if (r.chance(0.05)) return `{{state.nope.deep}} and {{ }}`;
		return r.chance(0.5) ? `<p>${t}</p>` : t;
	};
	const style = (): Obj => {
		const out: Obj = {};
		for (let i = r.int(4); i >= 0; i--) {
			const k = r.pick(STYLE_KEYS);
			out[k] = r.chance(0.08) ? r.int(20) : r.chance(0.04) ? null : k.toLowerCase().includes('color') ? r.pick(COLORS) : r.pick(STYLE_VALUES);
		}
		return out;
	};

	// ── state the page carries (content.data.state, inputs defaults, the data prop) ──────────────
	const state: Obj = {
		title: weird(),
		flag: r.chance(0.5),
		n: r.int(5),
		list: Array.from({ length: r.int(4) }, (_, i) => ({ name: weird(), i, on: r.chance(0.5) })),
		tags: Array.from({ length: r.int(3) }, () => weird()),
		obj: { a: 1, b: weird() },
		html: '<em>x</em>',
		zero: 0,
		empty: []
	};
	const code_for = (target: 'text' | 'bool' | 'style' | 'any'): string => {
		if (r.chance(0.05)) return ''; // empty binding
		if (r.chance(0.04)) return 'state.nope.deep'; // throws
		if (r.chance(0.03)) return 'return )('; // syntax error
		switch (target) {
			case 'bool':
				return r.pick(['state.flag', '!state.flag', 'state.n > 2', 'state.list.length', 'true', 'false', 'null', 'state.missing', '0', '"yes"']);
			case 'style':
				return r.pick(['"red"', 'state.flag ? "blue" : "green"', 'state.n + "px"', 'state.missing', '12', 'null']);
			case 'text':
				return r.pick([
					'state.title',
					'"<b>" + state.n + "</b>"',
					'var x = state.n * 2; return "v" + x',
					'state.obj.b',
					'state.list.map(i => i.name).join(",")',
					'state.missing',
					'state.zero',
					'state.html',
					'state.$index',
					'state.item && state.item.name',
					'state.listItem && state.listItem.name',
					'Builder.isServer ? "server" : "client"',
					'context.symbolId || "none"'
				]);
			default:
				return r.pick(['state.title', 'state.obj', 'state.list', 'state.n', 'state.flag', '{ a: 1 }', '[1, 2]', 'state.missing']);
		}
	};

	let budget = 20 + r.int(80); // blocks to generate (rough)
	const blocks = (depth: number, max = 4): Json[] => {
		const n = budget > 0 ? r.int(max + 1) : 0;
		const out: Json[] = [];
		for (let i = 0; i < n; i++) out.push(block(depth + 1));
		if (r.chance(0.01)) out.push(null as unknown as Json); // a null in a block list
		return out;
	};

	function component(depth: number): Obj | undefined {
		const kind = r.int(30);
		const o = (name: string, options?: Obj): Obj => (options === undefined ? { name } : { name, options });
		switch (kind) {
			case 0:
			case 1:
			case 2:
			case 3:
				return o('Text', { text: maybe_loc(html_text()) });
			case 4:
				return o('Core:Button', {
					text: maybe_loc(weird()),
					...(r.chance(0.6) ? { link: r.pick(['/go', 'https://x.test/?a=1&b=2', '', '#top', 'javascript:void(0)']) } : {}),
					...(r.chance(0.4) ? { openLinkInNewTab: r.chance(0.5) } : {})
				});
			case 5:
				return o('Columns', {
					columns: Array.from({ length: r.int(4) }, () => {
						const col: Obj = { blocks: blocks(depth, 3) };
						if (r.chance(0.4)) col.width = r.pick([20, 33.3, 50, 100, 0]);
						if (r.chance(0.2)) col.link = r.pick(['/col', '']);
						return col;
					}),
					...(r.chance(0.5) ? { space: r.pick([0, 10, 20, 37]) } : {}),
					...(r.chance(0.5) ? { stackColumnsAt: r.pick(['tablet', 'mobile', 'never']) } : {}),
					...(r.chance(0.3) ? { reverseColumnsWhenStacked: r.chance(0.5) } : {})
				});
			case 6:
				return o('Image', {
					image: r.pick([
						'https://cdn.builder.io/api/v1/image/assets%2Fabc%2Fdef?width=300',
						'https://cdn.builder.io/api/v1/image/assets%2Fabc%2Fdef',
						'https://example.com/a.png',
						'/local.svg',
						''
					]),
					...(r.chance(0.5) ? { aspectRatio: r.pick([0.5, 1, 0.5625, 0]) } : {}),
					...(r.chance(0.4) ? { altText: weird() } : {}),
					...(r.chance(0.3) ? { backgroundSize: r.pick(['cover', 'contain']) } : {}),
					...(r.chance(0.3) ? { backgroundPosition: r.pick(['center', 'top left']) } : {}),
					...(r.chance(0.2) ? { fitContent: r.chance(0.5) } : {}),
					...(r.chance(0.2) ? { lazy: r.chance(0.5) } : {}),
					...(r.chance(0.2) ? { srcset: 'a.png 1x, b.png 2x' } : {}),
					...(r.chance(0.2) ? { sizes: '100vw' } : {}),
					...(r.chance(0.2) ? { highPriority: r.chance(0.5) } : {}),
					...(r.chance(0.2) ? { title: weird() } : {})
				});
			case 7:
				return o('Core:Section', { ...(r.chance(0.6) ? { maxWidth: r.pick([900, 1200, 0]) } : {}), ...(r.chance(0.2) ? { lazyLoad: r.chance(0.5) } : {}) });
			case 8:
				return o('Fragment');
			case 9: {
				const sym: Obj = {};
				if (r.chance(0.9)) {
					sym.model = 'symbol';
					sym.entry = 'sym-' + r.int(3);
					sym.content = { id: 'sym-content-' + r.int(3), data: { blocks: blocks(depth, 3), ...(r.chance(0.3) ? { state: { title: 'from symbol state' } } : {}) } };
				}
				if (r.chance(0.5)) sym.data = { title: 'symbol data ' + weird(), slotA: blocks(depth, 2) };
				if (r.chance(0.2)) sym.inline = true;
				if (r.chance(0.1)) sym.dynamic = true;
				return o('Symbol', { symbol: sym });
			}
			case 10:
				return o('Builder: Tabs', {
					tabs: Array.from({ length: r.int(3) }, () => ({ label: blocks(depth, 2), content: blocks(depth, 2) })),
					...(r.chance(0.5) ? { defaultActiveTab: r.int(3) } : {}),
					...(r.chance(0.3) ? { activeTabStyle: { color: 'red' } } : {}),
					...(r.chance(0.3) ? { collapsible: r.chance(0.5) } : {}),
					...(r.chance(0.3) ? { tabHeaderLayout: r.pick(['flex-start', 'center', 'space-between']) } : {})
				});
			case 11:
				return o('Builder:Accordion', {
					items: Array.from({ length: r.int(3) }, () => ({ title: blocks(depth, 2), detail: blocks(depth, 2) })),
					...(r.chance(0.3) ? { oneAtATime: r.chance(0.5) } : {}),
					...(r.chance(0.3) ? { grid: r.chance(0.5) } : {}),
					...(r.chance(0.3) ? { gridRowWidth: r.pick(['25%', '50%']) } : {}),
					...(r.chance(0.2) ? { useChildrenForItems: r.chance(0.5) } : {})
				});
			case 12:
				return o('Form:Form', {
					...(r.chance(0.5) ? { sendSubmissionsTo: r.pick(['builder', 'email', 'custom', 'zapier']) } : {}),
					...(r.chance(0.4) ? { action: '/submit' } : {}),
					...(r.chance(0.4) ? { method: r.pick(['POST', 'GET']) } : {}),
					...(r.chance(0.4) ? { name: weird() } : {}),
					...(r.chance(0.3) ? { contentType: 'application/json' } : {}),
					...(r.chance(0.3) ? { validate: r.chance(0.5) } : {}),
					...(r.chance(0.2) ? { previewState: r.pick(['unsubmitted', 'sending', 'success', 'error']) } : {}),
					...(r.chance(0.3) ? { successMessage: blocks(depth, 1), errorMessage: blocks(depth, 1), sendingMessage: blocks(depth, 1) } : {})
				});
			case 13:
				return o('Form:Input', {
					name: r.pick(['email', 'q', '']),
					...(r.chance(0.6) ? { type: r.pick(['text', 'email', 'number', 'checkbox']) } : {}),
					...(r.chance(0.5) ? { placeholder: weird() } : {}),
					...(r.chance(0.3) ? { required: r.chance(0.5) } : {}),
					...(r.chance(0.3) ? { defaultValue: weird() } : {}),
					...(r.chance(0.1) ? { value: 'v' } : {})
				});
			case 14:
				return o('Form:Select', {
					name: 'pick',
					options: Array.from({ length: r.int(3) }, (_, i) => ({ value: 'v' + i, ...(r.chance(0.7) ? { name: weird() } : {}) })),
					...(r.chance(0.4) ? { defaultValue: 'v1' } : {}),
					...(r.chance(0.3) ? { required: r.chance(0.5) } : {})
				});
			case 15:
				return o('Form:SubmitButton', { text: weird() });
			case 16:
				return o('Form:TextArea', {
					name: 'msg',
					...(r.chance(0.5) ? { placeholder: weird() } : {}),
					...(r.chance(0.3) ? { defaultValue: weird() } : {}),
					...(r.chance(0.3) ? { required: r.chance(0.5) } : {})
				});
			case 17:
				return o('Custom Code', {
					code: r.pick(['<div class="cc">code</div>', '<script>window.y = 1</script><p>after</p>', weird(), '']),
					...(r.chance(0.3) ? { scriptsClientOnly: r.chance(0.5) } : {}),
					...(r.chance(0.2) ? { replaceNodes: r.chance(0.5) } : {})
				});
			case 18:
				return o('Embed', { content: r.pick(['<iframe src="about:blank"></iframe>', '<script>1</script>', weird(), '']) });
			case 19:
				return o('Raw:Img', {
					image: r.pick(['https://cdn.builder.io/x.png', '', 'a.svg']),
					...(r.chance(0.4) ? { altText: weird() } : {}),
					...(r.chance(0.3) ? { title: weird() } : {}),
					...(r.chance(0.3) ? { backgroundSize: 'cover' } : {}),
					...(r.chance(0.3) ? { aspectRatio: 0.5 } : {})
				});
			case 20:
				return o('Video', {
					video: r.pick(['https://x.test/v.mp4', '']),
					...(r.chance(0.5) ? { autoPlay: r.chance(0.5) } : {}),
					...(r.chance(0.5) ? { muted: r.chance(0.5) } : {}),
					...(r.chance(0.5) ? { controls: r.chance(0.5) } : {}),
					...(r.chance(0.5) ? { loop: r.chance(0.5) } : {}),
					...(r.chance(0.5) ? { playsInline: r.chance(0.5) } : {}),
					...(r.chance(0.4) ? { aspectRatio: r.pick([0.5625, 0, 1]) } : {}),
					...(r.chance(0.3) ? { fit: r.pick(['cover', 'contain']) } : {}),
					...(r.chance(0.3) ? { position: 'center' } : {}),
					...(r.chance(0.3) ? { posterImage: 'p.png' } : {}),
					...(r.chance(0.3) ? { lazyLoad: r.chance(0.5) } : {}),
					...(r.chance(0.3) ? { fitContent: r.chance(0.5) } : {}),
					...(r.chance(0.2) ? { preload: 'none' } : {})
				});
			case 21:
				return o('Slot', { name: r.pick(['slotA', 'blocksInState', 'missing']) });
			case 22:
				return o('PersonalizationContainer', {
					variants: Array.from({ length: r.int(3) }, () => ({
						query: r.chance(0.5) ? [{ property: r.pick(['segment', 'locale']), operator: r.pick(['is', 'isNot']), value: r.pick(['pro', 'fr-FR']) }] : [],
						blocks: blocks(depth, 2),
						startDate: r.chance(0.2) ? '2020-01-01T00:00:00.000Z' : null,
						endDate: r.chance(0.2) ? '2099-01-01T00:00:00.000Z' : null
					})),
					...(r.chance(0.2) ? { previewingIndex: r.pick([null, 0, 1]) } : {})
				});
			case 23:
				return o('Builder:RawText', { text: weird() });
			case 24:
				return o(r.pick(UNKNOWN_NAMES), r.chance(0.5) ? { text: weird() } : undefined);
			case 25:
			case 26:
			case 27: {
				const opts: Obj = { title: maybe_loc(weird()) };
				if (r.chance(0.4)) opts.items = blocks(depth, 3);
				if (r.chance(0.2)) opts.nested = { deep: maybe_loc('deep'), arr: [maybe_loc(1), null, 'x'] };
				if (r.chance(0.1)) opts.n = null;
				if (r.chance(0.1)) opts.text = '{{state.title}}';
				return o(r.pick(CUSTOM_NAMES), opts);
			}
			default:
				return undefined;
		}
	}

	function block(depth: number): Json {
		budget--;
		const b: Obj = { '@type': E };
		if (r.chance(0.7)) b['@version'] = 2;
		const bid = id();
		if (bid !== undefined) b.id = bid;
		const comp = depth > 58 ? undefined : component(depth);
		if (comp) b.component = comp;
		else if (r.chance(0.03)) b.component = null as unknown as Json;

		if (r.chance(0.18)) b.tagName = r.pick(TAGS);
		if (r.chance(0.08)) b.href = r.pick(['/h', 'https://x.test/?q="1"&r=<2>', '']);
		if (r.chance(0.2)) {
			const p: Obj = {};
			if (r.chance(0.4)) p['data-x'] = weird();
			if (r.chance(0.3)) p.title = weird();
			if (r.chance(0.2)) p.class = r.pick(['from-props', 'a b', '']);
			if (r.chance(0.15)) p.href = r.pick(['/ph', '']);
			if (r.chance(0.15)) p.target = '_blank';
			if (r.chance(0.15)) p['aria-label'] = weird();
			if (r.chance(0.1)) p.disabled = r.chance(0.5) as unknown as Json;
			if (r.chance(0.1)) p.hidden = r.pick([true, false, 'until-found']);
			if (r.chance(0.1)) p.onclick = 'alert(1)';
			if (r.chance(0.1)) p.translate = r.chance(0.5);
			if (r.chance(0.1)) p.tabIndex = r.int(3);
			if (r.chance(0.05)) p.style = 'color: red';
			if (r.chance(0.05)) p.src = '/p.png';
			b.properties = p;
		}
		if (r.chance(0.12)) b.class = r.pick(['from-block', 'x y', '']);
		if (r.chance(0.15)) b.style = style();
		if (r.chance(0.6)) {
			const rs: Obj = {};
			for (const size of ['large', 'medium', 'small', 'xsmall']) if (r.chance(size === 'large' ? 0.8 : 0.3)) rs[size] = style();
			b.responsiveStyles = rs;
		}
		if (r.chance(0.08)) b.show = r.pick([true, false, null, 0, 1]);
		if (r.chance(0.08)) b.hide = r.pick([true, false, null, 0, 1]);
		if (r.chance(0.15)) {
			const bind: Obj = {};
			for (let i = r.int(3); i >= 0; i--) {
				const path = r.pick([
					'component.options.text',
					'component.options.title',
					'component.options.link',
					'style.color',
					'style.marginTop',
					'responsiveStyles.large.color',
					'properties.title',
					'properties.data-b',
					'properties.href',
					'show',
					'hide',
					'tagName',
					'component.options.items.0.x'
				]);
				bind[path] =
					path === 'show' || path === 'hide'
						? code_for('bool')
						: path.startsWith('style') || path.startsWith('responsive')
							? code_for('style')
							: path === 'tagName'
								? r.pick(['"span"', '"a"', 'state.missing'])
								: code_for('text');
			}
			b.bindings = bind;
		}
		if (r.chance(0.07)) {
			const collection = r.pick(['state.list', 'state.tags', 'state.nothing', 'state.obj', 'state.empty', 'state.list.filter(x => x.on)', 'state.n']);
			b.repeat = { collection, ...(r.chance(0.5) ? { itemName: r.pick(['item', 'row']) } : {}) };
		}
		if (r.chance(0.07)) b.actions = { [r.pick(['click', 'mouseEnter', 'Submit'])]: 'state.clicked = true' };
		if (r.chance(0.06)) {
			b.animations = [
				{
					trigger: r.pick(['hover', 'hover', 'scrollInView', 'pageLoad']),
					duration: r.pick([0.3, 1, 0]),
					...(r.chance(0.5) ? { delay: r.pick([0, 0.1]) } : {}),
					easing: r.pick(['easeInOut', 'linear', 'cubic-bezier(.37,.01,0,.98)']),
					steps: [{ styles: {} }, { styles: r.chance(0.8) ? { opacity: '0.5' } : {} }]
				}
			];
		}
		if (r.chance(0.04)) b.meta = { previousId: 'x', nonTranslatableInputs: ['a'] };
		if (r.chance(0.03)) b.options = { extra: weird() };
		// children: deep chains and wide lists now and then
		if (depth < 58 && budget > 0) {
			if (r.chance(0.02)) {
				let chain: Json = block(depth + 50 > 58 ? 58 : depth + 50);
				const len = Math.min(58 - depth, 10 + r.int(50));
				for (let i = 0; i < len; i++) {
					const cid = id();
					chain = { '@type': E, ...(cid !== undefined ? { id: cid } : {}), ...(r.chance(0.2) ? { responsiveStyles: { large: style() } } : {}), children: [chain] };
				}
				b.children = [chain];
			} else if (r.chance(0.02)) {
				b.children = Array.from({ length: 20 + r.int(40) }, () => ({ '@type': E, id: 'builder-wide-' + ++uid, component: { name: 'Text', options: { text: weird() } } }));
			} else if (r.chance(0.5)) {
				const kids = blocks(depth);
				if (kids.length || r.chance(0.3)) b.children = kids;
			}
		}
		if (r.chance(0.01)) b.children = null as unknown as Json;
		return b;
	}

	const top = blocks(0, 6);
	while (budget > 0 && top.length < 3) top.push(block(1));

	const data: Obj = { blocks: top };
	if (r.chance(0.5)) data.state = state;
	if (r.chance(0.3)) data.inputs = [{ name: 'title', defaultValue: 'from input' }, { name: 'n', defaultValue: 3 }, { name: 'noDefault' }];
	if (r.chance(0.15)) data.cssCode = r.pick(['& .x { color: red; } .y & { margin: 0 }', '.z { top: 0 }', '']);
	if (r.chance(0.1))
		data.customFonts = [
			{ family: 'Inter', kind: 'sans-serif', fileUrl: 'https://f/inter.woff2', files: { regular: 'https://f/r.woff2', 700: 'https://f/b.woff2', italic: 'https://f/i.woff2' } }
		];
	if (r.chance(0.1)) data.jsCode = r.pick(['state.title = "js:" + (state.title || "")', 'state.n = 4;', 'throw new Error("boom")']);
	// a Slot reads its blocks from root state
	if (r.chance(0.1)) data.state = { ...((data.state as Obj) ?? {}), blocksInState: blocks(0, 2) };

	const content: Obj = { id: 'content-' + (seed >>> 0).toString(16), name: 'fuzz', data };
	if (r.chance(0.2)) content.meta = { breakpoints: r.pick([{ xsmall: 400, small: 700, medium: 1100 }, { small: 500, medium: 900 }, { medium: 800 }, {}]) };
	if (r.chance(0.03)) delete content.id;

	const spec: Spec = { content };
	if (r.chance(0.3)) {
		spec.data = { title: 'from data prop', n: 1 };
		if (r.chance(0.3)) spec.data.blocksInState = blocks(0, 2);
		// `data` merges into content.data: its own `blocks` replace the content's
		if (r.chance(0.05)) spec.data.blocks = blocks(0, 3);
	}
	if (r.chance(0.3)) spec.locale = r.pick(['en-US', 'fr-FR', 'de-DE']);
	return spec;
}
