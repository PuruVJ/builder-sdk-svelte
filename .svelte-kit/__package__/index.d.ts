/**
 * @puruvj/builder-sdk-svelte — a Builder.io renderer for Svelte 5, with the official SDK's public API.
 */
import type { BuilderContent, RegisteredComponent } from './types.js';
import Button from './blocks/Button.svelte';
import Columns from './blocks/Columns.svelte';
import Fragment from './blocks/Fragment.svelte';
import Image from './blocks/Image.svelte';
import Section from './blocks/Section.svelte';
import Symbol from './blocks/Symbol.svelte';
import Text from './blocks/Text.svelte';
import { builder_search_params, type GetContentOptions } from './internal/fetch.js';
import { is_editing, is_previewing } from './internal/env.js';
import { type TrackEvent } from './internal/track.js';
import { set_user_attributes } from './internal/user-attributes.js';
/** The built-in blocks with the official flags (name, noWrap, which builder props each receives). */
export declare const DEFAULT_COMPONENTS: RegisteredComponent[];
export { default as Content } from './components/Content.svelte';
export { default as Blocks } from './components/Blocks.svelte';
export { Button, Columns, Fragment, Image, Section, Symbol, Text };
export type { BuilderBlock, BuilderContent, RegisteredComponent, RegisteredComponents, RegisteredComponent as ComponentInfo } from './types.js';
export declare const isEditing: typeof is_editing;
export declare const isPreviewing: typeof is_previewing;
export declare const setClientUserAttributes: typeof set_user_attributes;
export declare const getBuilderSearchParams: typeof builder_search_params;
export declare const track: (args: Omit<TrackEvent, "canTrack">) => Promise<void>;
export declare function fetchEntries(options: GetContentOptions): Promise<BuilderContent[]>;
export declare function fetchOneEntry(options: GetContentOptions): Promise<BuilderContent | null>;
/** official `_processContentResult` (the server leg: results as-is; A/B assignment is browser-side). */
export declare function _processContentResult(_options: GetContentOptions, content: {
    results: BuilderContent[];
}): Promise<BuilderContent[]>;
/** Editor-facing registration — the official SDK's; the editor itself runs the official SDK here. */
export declare function register(_type: string, _info: unknown): void;
export declare function registerAction(_action: unknown): void;
export declare function setEditorSettings(_settings: unknown): void;
export declare function subscribeToEditor(): () => void;
export type { GetContentOptions };
