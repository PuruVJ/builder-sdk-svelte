/**
 * @puruvj/builder-sdk-svelte — a Builder.io renderer for Svelte 5, with the official SDK's public API.
 *
 * Importing this module runs nothing: every export is a value or a function (the package is
 * `sideEffects`-free). The built-in block list is built on first use (internal/defaults.ts).
 */
import type { BuilderContent } from './types.js';
import { fetch_entries, fetch_one_entry, builder_search_params, type GetContentOptions } from './internal/fetch.js';
import { is_browser, is_editing, is_previewing } from './internal/env.js';
import {
	create_register_component_message,
	register as register_editor,
	register_action,
	set_editor_settings
} from './internal/editor.js';
import { load_official } from './internal/official.js';
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
export type {
	BuilderBlock,
	BuilderContent,
	RegisteredComponent,
	RegisteredComponents,
	RegisteredComponent as ComponentInfo
} from './types.js';
// @ts-ignore optional peer
export type {
	BlocksProps,
	BuilderContextInterface,
	ButtonProps,
	ColumnProps,
	ContentProps,
	FragmentProps,
	ImageProps,
	InsertMenuConfig,
	InsertMenuItem,
	SectionProps,
	Settings,
	SymbolProps,
	TextProps,
	VideoProps
} from '@builder.io/sdk-svelte/bundle/browser';

export const isEditing = is_editing;
export const isPreviewing = is_previewing;
export const setClientUserAttributes = set_user_attributes;
export const getBuilderSearchParams = builder_search_params;
export const track = (args: Omit<TrackEvent, 'canTrack'>) => track_event({ ...args, canTrack: true });

export async function fetchEntries(options: GetContentOptions): Promise<BuilderContent[]> {
	return fetch_entries(options);
}
export async function fetchOneEntry(options: GetContentOptions): Promise<BuilderContent | null> {
	return fetch_one_entry(options);
}
/** official `_processContentResult` (the server leg: results as-is; A/B assignment is browser-side). */
export async function _processContentResult(_options: GetContentOptions, content: { results: BuilderContent[] }) {
	return content.results;
}

/** official `fetchBuilderProps`: the props `<Content>` needs for a url (or path + search params). */
export async function fetchBuilderProps(args: GetContentOptions & { path?: string; url?: URL; searchParams?: URLSearchParams | Record<string, unknown> }) {
	const urlPath = args.path || args.url?.pathname || (args.userAttributes?.urlPath as string | undefined);
	const options: GetContentOptions = {
		...args,
		model: args.model || 'page',
		userAttributes: { ...args.userAttributes, ...(urlPath ? { urlPath } : {}) },
		options: builder_search_params((args.searchParams || args.url?.searchParams || args.options) as never)
	};
	return { apiKey: options.apiKey, model: options.model, content: await fetch_one_entry(options) };
}

export const register = register_editor;
export const registerAction = register_action;
export const setEditorSettings = set_editor_settings;
export const createRegisterComponentMessage = create_register_component_message;

/** official `subscribeToEditor`: content updates of `model` from the editor; runs in the official SDK so its editor setup is shared. */
export function subscribeToEditor(args: { model: string; apiKey: string; callback: (content: BuilderContent) => void; trustedHosts?: string[] }): () => void {
	if (!is_browser()) return () => {};
	let stop: (() => void) | undefined;
	let stopped = false;
	load_official().then((m) => {
		if (m && !stopped) stop = m.subscribeToEditor(args);
	});
	return () => {
		stopped = true;
		stop?.();
	};
}
export type { GetContentOptions };
