/**
 * @puruvj/builder-sdk-svelte — a Builder.io renderer for Svelte 5, with the official SDK's public API.
 *
 * Importing this module runs nothing: every export is a value or a function (the package is
 * `sideEffects`-free). The built-in block list is built on first use (internal/defaults.ts).
 */
import type { BuilderContent } from './types.js';
import { fetch_entries, fetch_one_entry, builder_search_params, type GetContentOptions } from './internal/fetch.js';
import { is_editing, is_previewing } from './internal/env.js';
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
export type {
	BuilderBlock,
	BuilderContent,
	RegisteredComponent,
	RegisteredComponents,
	RegisteredComponent as ComponentInfo
} from './types.js';

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

/** Editor-facing registration — the official SDK's; the editor itself runs the official SDK here. */
export function register(_type: string, _info: unknown): void {}
export function registerAction(_action: unknown): void {}
export function setEditorSettings(_settings: unknown): void {}
export function subscribeToEditor(): () => void {
	return () => {};
}
export type { GetContentOptions };
