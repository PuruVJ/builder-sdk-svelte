import type { Component } from 'svelte';

/** A Builder block, as the Content API returns it. Loose on purpose: content is data. */
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
		large?: Record<string, unknown>;
		medium?: Record<string, unknown>;
		small?: Record<string, unknown>;
		xsmall?: Record<string, unknown>;
	};
	component?: { name: string; options?: Record<string, unknown> };
	options?: Record<string, unknown>;
	bindings?: Record<string, string>;
	actions?: Record<string, string>;
	properties?: Record<string, string>;
	style?: Record<string, unknown>;
	repeat?: { collection: string; itemName?: string } | null;
	animations?: Array<{
		trigger?: string;
		duration?: number;
		delay?: number;
		easing?: string;
		steps?: Array<{ styles?: Record<string, unknown> }>;
		[k: string]: unknown;
	}>;
	hide?: boolean;
	show?: boolean;
	meta?: Record<string, unknown>;
	[k: string]: unknown;
}

export interface BuilderContent {
	id?: string;
	name?: string;
	testVariationId?: string;
	testRatio?: number;
	variations?: Record<string, BuilderContent | undefined>;
	data?: {
		blocks?: BuilderBlock[];
		state?: Record<string, unknown>;
		inputs?: Array<{ name?: string; defaultValue?: unknown }>;
		cssCode?: string;
		jsCode?: string;
		customFonts?: CustomFont[];
		httpRequests?: Record<string, string>;
		[k: string]: unknown;
	};
	meta?: { breakpoints?: { xsmall?: number; small?: number; medium?: number }; [k: string]: unknown };
	[k: string]: unknown;
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
	[k: string]: unknown;
}

export type RegisteredComponents = Record<string, RegisteredComponent>;
