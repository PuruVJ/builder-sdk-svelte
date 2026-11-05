import type { Component } from 'svelte';
import type { BuilderBlock as OfficialBuilderBlock } from './official/types/builder-block.js';
import type { DeepPartial } from './official/types/deep-partial.js';

/**
 * The renderer's own view of the data: a Builder block, as the Content API returns it. Loose on
 * purpose (content is data), and with `any` where the official types are interfaces, so a value
 * typed with the official declarations (what the package exports, src/lib/official) is accepted.
 */
export interface BuilderBlock {
	'@type'?: '@builder.io/sdk:Element';
	'@version'?: number;
	id?: string;
	tagName?: string;
	layerName?: string;
	class?: string;
	href?: string;
	children?: BuilderBlock[];
	responsiveStyles?: {
		large?: Record<string, any>;
		medium?: Record<string, any>;
		small?: Record<string, any>;
		xsmall?: Record<string, any>;
	};
	component?: { name: string; options?: Record<string, any> };
	options?: Record<string, any>;
	bindings?: Record<string, string>;
	actions?: Record<string, string>;
	properties?: Record<string, string>;
	style?: Record<string, any>;
	repeat?: { collection: string; itemName?: string } | null;
	animations?: Array<{
		trigger?: string;
		duration?: number;
		delay?: number;
		easing?: string;
		steps?: Array<{ styles?: Record<string, any> }>;
		[k: string]: any;
	}>;
	hide?: boolean;
	show?: boolean;
	meta?: Record<string, any>;
	[k: string]: any;
}

export interface BuilderContent {
	id?: string;
	name?: string;
	testVariationId?: string;
	testRatio?: number;
	variations?: Record<string, BuilderContent | undefined>;
	data?: {
		blocks?: BuilderBlock[];
		state?: Record<string, any>;
		inputs?: Array<{ name?: string; defaultValue?: any }>;
		cssCode?: string;
		jsCode?: string;
		customFonts?: CustomFont[];
		httpRequests?: Record<string, string>;
		[k: string]: any;
	};
	meta?: { breakpoints?: { xsmall?: number; small?: number; medium?: number } | null; [k: string]: any };
	[k: string]: any;
}

export interface CustomFont {
	family?: string;
	kind?: string;
	fileUrl?: string;
	files?: Record<string, string>;
}

/** Which Builder props a registered component receives (official `shouldReceiveBuilderProps`). */
export interface BuilderPropsFlags {
	builderBlock?: boolean;
	builderContext?: boolean;
	builderComponents?: boolean;
	builderLinkComponent?: boolean;
}

/** A registered component: the component plus its Builder info (same shape as the official SDK). */
export interface RegisteredComponent {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	component: Component<any> | any;
	name: string;
	inputs?: unknown[];
	models?: string[];
	noWrap?: boolean;
	canHaveChildren?: boolean;
	shouldReceiveBuilderProps?: BuilderPropsFlags;
	[k: string]: any;
}

export type RegisteredComponents = Record<string, RegisteredComponent>;

// ── Official public types that live in official RUNTIME modules (functions/register.ts,
// functions/set-editor-settings.ts), so they are not vendored with the rest (src/lib/official) ──

export interface InsertMenuItem {
	name: string;
	icon?: string;
	item: DeepPartial<OfficialBuilderBlock>;
}
export interface InsertMenuConfig {
	name: string;
	priority?: number;
	persist?: boolean;
	advanced?: boolean;
	items: InsertMenuItem[];
}

/** official `functions/set-editor-settings.ts` */
export type Settings = {
	customInsertMenu?: boolean;
};
