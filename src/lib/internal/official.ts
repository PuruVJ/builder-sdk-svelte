/** The official SDK, loaded in the browser only when the page runs inside Builder (the editor or a preview). */

type Official = Record<string, any>;

let pending: Promise<Official | null> | null = null;
let context_key: symbol | undefined;

export function load_official(): Promise<Official | null> {
	return (pending ??= import(
		// @ts-ignore optional peer
		'@builder.io/sdk-svelte/bundle/browser'
	).then(
		(m: Official) => {
			context_key = m.BuilderContext?.key;
			return m;
		},
		(error: unknown) => {
			console.error('[@puruvj/builder-sdk-svelte] could not load @builder.io/sdk-svelte/bundle/browser, so the Builder editor gets no component info:', error);
			return null;
		}
	));
}

/** The official tree's `BuilderContext` key, once the official SDK has loaded. */
export function official_context_key(): symbol | undefined {
	return context_key;
}
