/**
 * @puruvj/builder-sdk-svelte — a Builder.io renderer for Svelte 5, with the official SDK's public API.
 *
 * Importing this module runs nothing: every export is a value or a function (the package is
 * `sideEffects`-free). The built-in block list is built on first use (internal/defaults.ts).
 */
import type { BuilderContent } from './official/types/builder-content.js';
import type { GetContentOptions } from './official/functions/get-content/types.js';
import { fetch_entries, fetch_one_entry, builder_search_params, type GetContentOptions as FetchOptions } from './internal/fetch.js';
import { is_browser, is_editing, is_previewing } from './internal/env.js';
import {
	create_register_component_message,
	register as register_editor,
	register_action,
	set_editor_settings
} from './internal/editor.js';
import { load_bridge } from './internal/live.js';
import { track as track_event, type TrackEvent } from './internal/track.js';
import { set_user_attributes } from './internal/user-attributes.js';

export { default as Content } from './components/Content.svelte';
export { default as Blocks } from './components/Blocks.svelte';
export { default as Button } from './blocks/Button.svelte';
export { default as Columns } from './blocks/Columns.svelte';
export { default as Fragment } from './blocks/Fragment.svelte';
export { default as Image } from './blocks/Image.svelte';
export { default as Section } from './blocks/Section.svelte';
export { default as Symbol } from './blocks/Symbol.svelte';
export { default as Text } from './blocks/Text.svelte';
export { default as Video } from './blocks/Video.svelte';
export { BuilderContext } from './internal/context.js';
// The public types are the official SDK's own declarations (vendored: scripts/vendor-official-types.mjs),
// the same ones its deep paths (`@builder.io/sdk-svelte/src/types/…`) resolve to — see package.json.
export type { BuilderBlock } from './official/types/builder-block.js';
export type { BuilderContent } from './official/types/builder-content.js';
export type { ComponentInfo } from './official/types/components.js';
export type { BuilderContextInterface, RegisteredComponent, RegisteredComponents } from './official/context/types.js';
export type { ButtonProps } from './official/blocks/button/button.types.js';
export type { ColumnProps } from './official/blocks/columns/columns.types.js';
export type { FragmentProps } from './official/blocks/fragment/fragment.types.js';
export type { ImageProps } from './official/blocks/image/image.types.js';
export type { SectionProps } from './official/blocks/section/section.types.js';
export type { SymbolProps } from './official/blocks/symbol/symbol.types.js';
export type { TextProps } from './official/blocks/text/text.types.js';
export type { VideoProps } from './official/blocks/video/video.types.js';
export type { BlocksProps } from './official/components/blocks/blocks.types.js';
export type { ContentVariantsPrps as ContentProps } from './official/components/content-variants/content-variants.types.js';
export type { GetContentOptions } from './official/functions/get-content/types.js';
export type { InsertMenuConfig, InsertMenuItem, Settings } from './types.js';

export const isEditing = is_editing;
export const isPreviewing = is_previewing;
export const setClientUserAttributes = set_user_attributes;
export const getBuilderSearchParams = builder_search_params;
export const track = (args: Omit<TrackEvent, 'canTrack'>) => track_event({ ...args, canTrack: true });

// (the public signatures carry the official types; the fetch layer has its own, looser view)
export async function fetchEntries(options: GetContentOptions): Promise<BuilderContent[]> {
	return fetch_entries(options as FetchOptions) as Promise<never>;
}
export async function fetchOneEntry(options: GetContentOptions): Promise<BuilderContent | null> {
	return fetch_one_entry(options as FetchOptions) as Promise<never>;
}
/** official `_processContentResult` (the server leg: results as-is; A/B assignment is browser-side). */
export async function _processContentResult(_options: GetContentOptions, content: { results: BuilderContent[] }) {
	return content.results;
}

/** official `fetchBuilderProps`: the props `<Content>` needs for a url (or path + search params). */
export async function fetchBuilderProps(args: GetContentOptions & { path?: string; url?: URL; searchParams?: URLSearchParams | Record<string, unknown> }) {
	const urlPath = args.path || args.url?.pathname || (args.userAttributes?.urlPath as string | undefined);
	const options: FetchOptions = {
		...(args as FetchOptions),
		model: args.model || 'page',
		userAttributes: { ...args.userAttributes, ...(urlPath ? { urlPath } : {}) },
		options: builder_search_params((args.searchParams || args.url?.searchParams || args.options) as never)
	};
	return { apiKey: options.apiKey, model: options.model, content: (await fetch_one_entry(options)) as BuilderContent | null };
}

export const register = register_editor;
export const registerAction = register_action;
export const setEditorSettings = set_editor_settings;
export const createRegisterComponentMessage = create_register_component_message;

/** official `subscribeToEditor`: content updates of `model` from the editor; call the returned function to stop. */
export function subscribeToEditor(args: { model: string; apiKey: string; callback: (content: BuilderContent) => void; trustedHosts?: string[] }): () => void {
	if (!is_browser()) {
		console.warn('[Builder.io]: `subscribeToEditor` only works in the browser. It currently seems to be running on the server.');
		return () => {};
	}
	// (the bridge is its own chunk: loaded only by a page that subscribes)
	let stop: (() => void) | undefined;
	let stopped = false;
	load_bridge().then((bridge) => {
		if (!stopped) stop = bridge.subscribe_to_editor(args as Parameters<typeof bridge.subscribe_to_editor>[0]);
	});
	return () => {
		stopped = true;
		stop?.();
	};
}
