<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BuilderBlock } from '../types.js';
	import { get_srcset, is_builder, is_builder_or_shopify, to_webp } from './image.js';

	let {
		image = undefined,
		src = undefined,
		srcset = undefined,
		noWebp = undefined,
		aspectRatio = undefined,
		highPriority = undefined,
		altText = undefined,
		title = undefined,
		backgroundPosition = undefined,
		backgroundSize = undefined,
		className = undefined,
		sizes = undefined,
		builderBlock = undefined,
		fitContent = undefined,
		children
	}: {
		image?: string;
		src?: string;
		srcset?: string;
		noWebp?: boolean;
		aspectRatio?: number;
		highPriority?: boolean;
		altText?: string;
		title?: string;
		backgroundPosition?: string;
		backgroundSize?: string;
		className?: string;
		sizes?: string;
		builderBlock?: BuilderBlock;
		fitContent?: boolean;
		children?: Snippet;
		[k: string]: unknown;
	} = $props();

	/** official `srcSetToUse` */
	function srcset_to_use(): string | undefined {
		const url = image || src;
		if (!url || !(typeof url === 'string' && is_builder_or_shopify(url))) return srcset;
		if (noWebp) return undefined;
		if (srcset && image?.includes('builder.io/api/v1/image')) {
			if (!srcset.includes(image.split('?')[0])) return get_srcset(url);
		} else if (image && !srcset) return get_srcset(url);
		return get_srcset(url);
	}
	function webp(s: string | undefined): string {
		return s && is_builder(s) && !noWebp ? to_webp(s) : '';
	}
	const has_children = $derived(!!builderBlock?.children?.length);
</script>

{#snippet picture(s: string | undefined)}
	<picture>
		{#if webp(s)}
			<source type="image/webp" srcset={webp(s)} />
		{/if}<img
			style="object-position:{backgroundPosition || 'center'};object-fit:{backgroundSize ||
				'cover'};{aspectRatio ? 'position:absolute;height:100%;width:100%;left:0px;top:0px;' : ''}"
			loading={highPriority ? 'eager' : 'lazy'}
			fetchpriority={highPriority ? 'high' : 'auto'}
			alt={altText}
			{title}
			role={altText ? undefined : 'presentation'}
			class={'builder-image' + (className ? ' ' + className : '') + ' img'}
			src={image}
			srcset={s}
			{sizes}
		/></picture
	>
{/snippet}
{@render picture(srcset_to_use())}

{#if aspectRatio && !(has_children && fitContent)}
	<div style="padding-top:{aspectRatio * 100 + '%'};" class="builder-image-sizer div"></div>
{/if}

{#if has_children && fitContent}
	{@render children?.()}
{/if}

{#if !fitContent && has_children}
	<div class="div-2">{@render children?.()}</div>
{/if}

<style>
	.img {
		opacity: 1;
		transition: opacity 0.2s ease-in-out;
	}
	.div {
		width: 100%;
		pointer-events: none;
		font-size: 0;
	}
	.div-2 {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}
</style>
