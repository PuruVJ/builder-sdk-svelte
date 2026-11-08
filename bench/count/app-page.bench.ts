/**
 * COUNTED APP-SHAPED SSR: one field request, the whole page's <Content> roots (accessibility, body,
 * support, footer) with the field's component shapes (bench/app/*), as bench/app-page.mjs times it:
 * the 230-entry body list kept by the app (same array each request), small inline lists and the
 * content made fresh per request.
 */
import { bench } from 'heisenbench/bench';
import { app_components, render_app_page, type AppRoot, type Sdk } from '../entry.ts';
import { fixture_text, names_in, spec_of } from './data.ts';

const KINDS: Array<[string, 'inline' | 'body']> = [
	['accessibilityContent', 'inline'],
	['pageContent', 'body'],
	['content', 'inline'],
	['getFooterContent', 'inline']
];

function page_of(page: string) {
	const raws = KINDS.map(([kind, list]) => ({ raw: fixture_text(`pages/${page}.${kind}`), list }));
	const all = [...names_in(raws.map((r) => JSON.parse(r.raw)))].sort();
	const lists = new Map<Sdk, unknown[]>();
	/** One request's roots: fresh content, fresh inline lists, the app's kept body list. */
	return (sdk: Sdk): AppRoot[] => {
		let body = lists.get(sdk);
		if (!body) lists.set(sdk, (body = app_components(sdk, { names: all, size: 230 })));
		return raws.map(({ raw, list }) => {
			const content = spec_of(raw).content;
			const components = list === 'body' ? body : app_components(sdk, { names: [...names_in(content)], size: 1 });
			return { model: 'page', content, components };
		});
	};
}

const PAGES: Array<[string, Sdk[]]> = [
	['landing-small', ['ours']],
	['landing', ['ours', 'official', 'latest']],
	['landing-large', ['ours']]
];

for (const [page, sdks] of PAGES) {
	const request = page_of(page);
	for (const sdk of sdks) {
		const label = sdk === 'ours' ? 'ours' : sdk === 'official' ? 'official 5.2' : 'official latest';
		bench(`app page · ${page} · ${label}`, ({ roots }) => render_app_page(sdk, roots).body.length, {
			setup: () => ({ roots: request(sdk) })
		});
	}
}
