import type { Component } from 'svelte';
import type { Writable } from 'svelte/store';

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

// ── The official public types, ported (no import from @builder.io/*) ─────────────────────────────

type Nullable<T> = T | null | undefined;
type Dictionary<T> = { [key: string]: T };
/** official `types/deep-partial.ts` */
type DeepPartial<T> = { [P in keyof T]?: T[P] extends Array<infer U> ? Array<DeepPartial<U>> : T[P] extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : DeepPartial<T[P]> };
/** official `types/api-version.ts` */
export type ApiVersion = 'v3';

type JSONValue = string | number | boolean | JSONObject | JSONArray;
interface JSONObject {
	[x: string]: JSONValue;
}
interface JSONArray extends Array<JSONValue> {}

/** official `types/input.ts`: one input of a component's editor schema. */
export interface Input {
	/** This is the name of the component prop this input represents */
	name: string;
	/** A friendlier name to show in the UI if the component prop name is not ideal for end users */
	friendlyName?: string;
	/** A description to show in the UI to give guidance on how to use this input */
	description?: string;
	/** A default value to use */
	defaultValue?: any;
	/**
	 * The type of input to use, such as 'text'
	 *
	 * See all available inputs [here](https://www.builder.io/c/docs/custom-react-components#input-types)
	 * and you can create your own custom input types and associated editor UIs with [plugins](https://www.builder.io/c/docs/extending/plugins)
	 */
	type: string;
	/** Is this input mandatory or not */
	required?: boolean;
	/** @hidden */
	autoFocus?: boolean;
	subFields?: Input[];
	/**
	 * When input is of `type` `object`, use this field to collapse multiple inputs
	 * in the Visual Editor by default and preserve screen space.
	 */
	folded?: boolean;
	/**
	 * When input is of `type` `object`, provide guidance in the Visual Editor
	 * on how to edit this object's contents.
	 */
	keysHelperText?: string;
	/** Additional text to render in the UI to give guidance on how to use this */
	helperText?: string;
	/** @hidden */
	allowedFileTypes?: string[];
	/** @hidden */
	imageHeight?: number;
	/** @hidden */
	imageWidth?: number;
	/** @hidden */
	mediaHeight?: number;
	/** @hidden */
	mediaWidth?: number;
	/** @hidden */
	hideFromUI?: boolean;
	/** @hidden */
	modelId?: string;
	/** Number field type validation maximum accepted input */
	max?: number;
	/** Number field type validation minimum accepted input */
	min?: number;
	/** Number field type step size when using arrows */
	step?: number;
	/**
	 * Set this to `true` to show the editor for this input when
	 * children of this component are selected. This is useful for things
	 * like Tabs, such that users may not always select the Tabs component
	 * directly but will still be looking for how to add additional tabs
	 */
	broadcast?: boolean;
	/**
	 * Set this to `true` to show the editor for this input when
	 * group locked parents of this component are selected. This is useful
	 * to bubble up important inputs for locked groups, like text and images
	 */
	bubble?: boolean;
	/** Set this to `true` if you want this component to be translatable */
	localized?: boolean;
	/** @hidden */
	options?: { [key: string]: any };
	/** For "text" input type, specifying an enum will show a dropdown of options instead */
	enum?: string[] | { label: string; value: any; helperText?: string }[];
	/** Regex field validation for all string types (text, longText, html, url, etc) */
	regex?: {
		/** pattern to test, like "^\/[a-z]$" */
		pattern: string;
		/** flags for the RegExp constructor, e.g. "gi"  */
		options?: string;
		/**
		 * Friendly message to display to end-users if the regex fails, e.g.
		 * "You must use a relative url starting with '/...' "
		 */
		message: string;
	};
	/**
	 * Set this to `true` to put this under the "show more" section of
	 * the options editor. Useful for things that are more advanced
	 * or more rarely used and don't need to be too prominent
	 */
	advanced?: boolean;
	/** @hidden */
	code?: boolean;
	/** @hidden */
	richText?: boolean;
	/** @hidden */
	showIf?: ((options: Map<string, any>) => boolean) | string;
	/** @hidden */
	copyOnAdd?: boolean;
	/** Use optionally with inputs of type `reference`. Restricts the content entry picker to a specific model by name. */
	model?: string;
	behavior?: string;
	valueType?: { type?: string };
	onChange?: ((options: Map<string, any>, previousOptions?: Map<string, any>) => void | Promise<void>) | string;
	meta?: Record<string, any>;
}

/** official `types/element.ts` */
export interface BuilderElement {
	'@type': '@builder.io/sdk:Element';
	'@version'?: number;
	id?: string;
	tagName?: string;
	layerName?: string;
	groupLocked?: boolean;
	layerLocked?: boolean;
	/** @todo make alias for properties.class */
	class?: string;
	children?: BuilderElement[];
	responsiveStyles?: {
		large?: Partial<CSSStyleDeclaration>;
		medium?: Partial<CSSStyleDeclaration>;
		small?: Partial<CSSStyleDeclaration>;
		/** @deprecated */
		xsmall?: Partial<CSSStyleDeclaration>;
	};
	component?: { name: string; options?: any; tag?: string };
	bindings?: { [key: string]: string };
	meta?: { [key: string]: JSONValue };
	actions?: { [key: string]: string };
	properties?: { [key: string]: string };
	code?: { bindings?: { [key: string]: string }; actions?: { [key: string]: string } };
	repeat?: { collection: string; itemName?: string } | null;
	animations?: {}[];
}

type Permission = 'read' | 'publish' | 'editCode' | 'editDesigns' | 'admin' | 'create';

/** official `types/components.ts`: a component's info, as the editor receives it (no `component`). */
export interface ComponentInfo {
	/**
	 * Name your component something unique, e.g. 'MyButton'. You can override built-in components
	 * by registering a component with the same name, e.g. 'Text', to replace the built-in text component
	 */
	name: string;
	description?: string;
	/** Link to a documentation page for this component */
	docsLink?: string;
	image?: string;
	/** Input schema for your component for users to fill in the options */
	inputs?: Input[];
	class?: any;
	type?: 'angular' | 'webcomponent' | 'react' | 'vue';
	defaultStyles?: { [key: string]: string };
	/** Turn on if your component can accept children. */
	canHaveChildren?: boolean;
	fragment?: boolean;
	/** Do not wrap a component in a dom element. Be sure to use {...props.attributes} with this option */
	noWrap?: boolean;
	/** Set this to `true` if your component is a React Server Component (RSC). */
	isRSC?: boolean;
	/** Default children */
	defaultChildren?: BuilderElement[];
	defaults?: Partial<BuilderElement>;
	// eslint-disable-next-line @typescript-eslint/ban-types
	hooks?: { [key: string]: string | Function };
	/** Hide your component in editor, useful for gradually deprecating components */
	hideFromInsertMenu?: boolean;
	// For webcomponents
	tag?: string;
	static?: boolean;
	/** Passing a list of model names will restrict using the component to only the models listed here, otherwise it'll be available for all models */
	models?: string[];
	/** Specify restrictions direct children must match */
	childRequirements?: {
		/** Message to show when this doesn't match, e.g. "Children of 'Columns' must be a 'Column'" */
		message: string;
		/** Simple way to say children must be a specific component name */
		component?: string;
		/** More advanced - specify a MongoDB-style query (using sift.js github.com/crcn/sift.js) of what the children objects should match */
		query?: any;
	};
	/** Specify restrictions any parent must match */
	requiresParent?: {
		/** Message to show when this doesn't match, e.g. "'Add to cart' buttons must be within a 'Product box'" */
		message: string;
		/** Simple way to say a parent must be a specific component name, e.g. 'Product box' */
		component?: string;
		/** More advanced - specify a MongoDB-style query (using sift.js github.com/crcn/sift.js) of what at least one parent in the parents hierarchy should match */
		query?: any;
	};
	friendlyName?: string;
	/** Use to restrict access to your component based on a the current user permissions */
	requiredPermissions?: Array<Permission>;
	hidden?: boolean;
	/** When overriding built-in components, set this to `true` to skip the default behavior the original has */
	override?: boolean;
	/** Whether or not the component should receive SDK-related props. */
	shouldReceiveBuilderProps?: BuilderPropsFlags;
	meta?: { [key: string]: any };
}

export type BuilderRenderState = Record<string, unknown>;
export type BuilderRenderContext = Record<string, unknown>;

/** official `components/blocks/blocks-wrapper.svelte` (module script) */
type BlocksWrapperProps = {
	blocks: BuilderBlock[] | undefined;
	parent: string | undefined;
	path: string | undefined;
	styleProp: Record<string, any> | undefined;
	/** The element that wraps each list of blocks. Defaults to a `div` element. */
	BlocksWrapper: any;
	/**
	 * Props to be applied to the wrapping element of blocks. Can be set in two ways:
	 * 1. Globally via `<Content blocksWrapperProps={{...}}/>` - applies to all blocks wrappers in the Content
	 * 2. Locally via `<Blocks BlocksWrapperProps={{...}}/>` - applies only to this specific blocks instance and overrides global props
	 */
	BlocksWrapperProps: any;
	children?: any;
	classNameProp?: string;
};

/** official `context/types.ts` */
export interface BuilderContextInterface extends Pick<BlocksWrapperProps, 'BlocksWrapper' | 'BlocksWrapperProps'> {
	content: Nullable<BuilderContent>;
	context: BuilderRenderContext;
	/**
	 * The state of the application.
	 *
	 * NOTE: see `localState` below to understand how it is different from `rootState`.
	 */
	rootState: BuilderRenderState;
	/**
	 * Some frameworks have a `setState` function which needs to be invoked to notify
	 * the framework of state change. (other frameworks don't in which case it is `undefined')
	 */
	rootSetState: ((rootState: BuilderRenderState) => void) | undefined;
	/**
	 * The local state of the current component. This is different from `rootState` in that
	 * it can be a child state created by a repeater containing local state.
	 * The `rootState` is where all of the state mutations are actually stored.
	 */
	localState: BuilderRenderState | undefined;
	apiKey: string | null;
	apiVersion: ApiVersion | undefined;
	componentInfos: Dictionary<ComponentInfo>;
	/** Used to recursively store all CSS coming from a parent that would apply to a Text block */
	inheritedStyles: Record<string, unknown>;
	nonce: string;
	model: string;
	canTrack?: boolean;
}

/** official `types/builder-props.ts` */
type BuilderDataProps = {
	builderBlock: BuilderBlock;
	builderContext: Writable<BuilderContextInterface>;
};
type BuilderComponentsProp = {
	builderComponents: RegisteredComponents;
};
type BuilderLinkComponentProp = {
	builderLinkComponent?: any;
};

/** official `components/blocks/blocks.types.ts` */
export type BlocksProps = Partial<Omit<BlocksWrapperProps, 'BlocksWrapper' | 'classNameProp'>> & {
	context?: Writable<BuilderContextInterface>;
	registeredComponents?: RegisteredComponents;
	linkComponent?: any;
	className?: string;
};

/** official `components/content-variants/content-variants.types.ts` (`ContentVariantsPrps`) */
export interface ContentProps {
	/** The Builder content JSON to render (required). */
	content: Nullable<BuilderContent>;
	/** The Builder content `model` to render (required). */
	model: string;
	/** Additional data to inject into your Builder content (optional). */
	data?: { [key: string]: any };
	context?: BuilderRenderContext;
	/** Your API Key: needed to enable visual editing, and to dynamically fetch symbols (required). */
	apiKey: string;
	/** Sets the host of Builder API calls. (Defaults to global `https://cdn.builder.io`) */
	apiHost?: string;
	apiVersion?: ApiVersion;
	/** An array of custom components to register (optional). */
	customComponents?: RegisteredComponent[];
	/** The component to use for rendering links. Defaults to anchor element `<a>`. */
	linkComponent?: any;
	/** A boolean to enable or disable tracking (optional). Defaults to `true`. */
	canTrack?: boolean;
	/** If provided, the API will auto-resolve localized objects to the value of this `locale` key (optional). */
	locale?: string;
	/**
	 * A boolean to enable or disable enriching API content (optional).
	 *
	 * Enriching will Include multilevel references in the response. Defaults to `false`.
	 */
	enrich?: boolean;
	/** The element that wraps your content. Defaults to `<div>`. */
	contentWrapper?: any;
	/** Additonal props to pass to `contentWrapper`. Defaults to `{}`. */
	contentWrapperProps?: any;
	/** The element that wraps your blocks. Defaults to `<div>`. */
	blocksWrapper?: any;
	/** Additonal props to pass to `blocksWrapper`. Defaults to `{}`. */
	blocksWrapperProps?: any;
	/** List of hosts to allow editing content from. */
	trustedHosts?: string[];
	/** A CSP nonce to use for the SDK's inlined `<script>` and `<style>` tags. */
	nonce?: string;
}

/** official `blocks/button/button.types.ts` */
export interface ButtonProps extends BuilderLinkComponentProp {
	attributes?: any;
	text?: string;
	link?: string;
	openLinkInNewTab?: boolean;
}

/** official `blocks/columns/columns.types.ts` */
export type Column = {
	blocks: BuilderBlock[];
	width?: number;
	link?: string;
};
export interface ColumnProps extends BuilderComponentsProp, BuilderLinkComponentProp, BuilderDataProps {
	columns?: Column[];
	space?: number;
	stackColumnsAt?: 'tablet' | 'mobile' | 'never';
	reverseColumnsWhenStacked?: boolean;
}

/** official `blocks/fragment/fragment.types.ts` */
export interface FragmentProps {
	maxWidth?: number;
	attributes?: any;
	children?: any;
}

/** official `blocks/image/image.types.ts` */
export interface ImageProps {
	attributes?: string;
	highPriority?: boolean;
	className?: string;
	image: string;
	sizes?: string;
	lazy?: boolean;
	height?: number;
	width?: number;
	altText?: string;
	title?: string;
	backgroundSize?: 'cover' | 'contain';
	backgroundPosition?: string;
	srcset?: string;
	aspectRatio?: number;
	lockAspectRatio?: boolean;
	children?: any;
	fitContent?: boolean;
	builderBlock?: BuilderBlock;
	noWebp?: boolean;
	src?: string;
}

/** official `blocks/section/section.types.ts` */
export interface SectionProps {
	maxWidth?: number;
	attributes?: any;
	children?: any;
	builderBlock?: any;
}

/** official `blocks/symbol/symbol.types.ts` */
export interface SymbolInfo {
	model?: string;
	entry?: string;
	data?: any;
	content?: BuilderContent;
	inline?: boolean;
	dynamic?: boolean;
	ownerId?: string;
	global?: boolean;
}
export interface SymbolProps extends BuilderComponentsProp, BuilderDataProps, BuilderLinkComponentProp {
	symbol?: SymbolInfo;
	dataOnly?: boolean;
	dynamic?: boolean;
	attributes?: any;
	inheritState?: boolean;
	renderToLiquid?: boolean;
}

/** official `blocks/text/text.types.ts` */
export type TextProps = {
	text?: string;
} & BuilderDataProps;

/** official `blocks/video/video.types.ts` */
export interface VideoProps {
	attributes?: any;
	video?: string;
	autoPlay?: boolean;
	controls?: boolean;
	muted?: boolean;
	loop?: boolean;
	playsInline?: boolean;
	aspectRatio?: number;
	width?: number;
	height?: number;
	fit?: 'contain' | 'cover' | 'fill';
	preload?: 'auto' | 'metadata' | 'none';
	position?: 'center' | 'top' | 'left' | 'right' | 'bottom' | 'top left' | 'top right' | 'bottom left' | 'bottom right';
	posterImage?: string;
	lazyLoad?: boolean;
	children?: any;
	fitContent?: boolean;
	builderBlock?: BuilderBlock;
}

/** official `functions/register.ts` */
export interface InsertMenuItem {
	name: string;
	icon?: string;
	item: DeepPartial<BuilderBlock>;
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
