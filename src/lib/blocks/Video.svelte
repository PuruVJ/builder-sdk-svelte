<script module lang="ts">
	const FILL_STYLE = 'display:flex;flex-direction:column;align-items:stretch;';
	const OVERLAY_STYLE =
		'pointer-events:none;display:flex;flex-direction:column;align-items:stretch;position:absolute;top:0;left:0;width:100%;height:100%;';

	/** One observer for every lazy video on the page: a video's sources load when it nears view. */
	let observer: IntersectionObserver | undefined;
	function lazy_observer(): IntersectionObserver {
		return (observer ??= new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const video = entry.target as HTMLVideoElement;
				try {
					for (const child of video.children) {
						if (child instanceof HTMLElement && child.tagName === 'SOURCE') {
							const src = (child as HTMLSourceElement).dataset.src;
							if (src) (child as HTMLSourceElement).src = src;
						}
					}
					video.load();
					observer!.unobserve(video);
				} catch (error) {
					console.error('Error loading lazy video:', error);
				}
			}
		}));
	}
</script>

<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type { BuilderBlock } from '../types.js';
	import { stringify_styles } from '../internal/css.js';

	let {
		lazyLoad = undefined,
		autoPlay = undefined,
		muted = undefined,
		controls = undefined,
		loop = undefined,
		playsInline = undefined,
		preload = undefined,
		attributes = undefined,
		fit = undefined,
		position = undefined,
		aspectRatio = undefined,
		posterImage = undefined,
		video = undefined,
		fitContent = undefined,
		builderBlock = undefined,
		children
	}: {
		lazyLoad?: boolean;
		autoPlay?: boolean;
		muted?: boolean;
		controls?: boolean;
		loop?: boolean;
		playsInline?: boolean;
		preload?: 'auto' | 'metadata' | 'none';
		attributes?: { style?: Record<string, unknown>; [k: string]: unknown };
		fit?: 'contain' | 'cover' | 'fill';
		position?: string;
		aspectRatio?: number;
		posterImage?: string;
		video?: string;
		fitContent?: boolean;
		width?: number;
		height?: number;
		builderBlock?: BuilderBlock;
		children?: Snippet;
		[k: string]: unknown;
	} = $props();

	let el: HTMLVideoElement | undefined;

	function video_style(): string {
		const extra = attributes?.style;
		// The common case (no inline style object): one string, no intermediate object.
		if (!extra) {
			return `width:100%;height:100%;object-fit:${fit};object-position:${position};border-radius:1px;${aspectRatio ? 'position:absolute;' : ''}`;
		}
		return stringify_styles({
			width: '100%',
			height: '100%',
			...extra,
			objectFit: fit,
			objectPosition: position,
			// Hack to get object fit to work as expected and not have the video overflow
			borderRadius: '1px',
			...(aspectRatio ? { position: 'absolute' } : null)
		});
	}

	const has_children = $derived(!!builderBlock?.children?.length);

	onMount(() => {
		if (!lazyLoad || !el) return;
		const o = lazy_observer();
		const target = el;
		o.observe(target);
		return () => o.unobserve(target);
	});
</script>

<div style="position:relative;">
	<video
		style={video_style()}
		class="builder-video"
		autoplay={autoPlay === true || undefined}
		muted={muted === true || undefined}
		controls={controls === true || undefined}
		loop={loop === true || undefined}
		playsinline={playsInline === true || undefined}
		bind:this={el}
		preload={lazyLoad ? 'none' : preload || 'metadata'}
		poster={posterImage}
		>{#if lazyLoad}<source type="video/mp4" data-src={video} />{:else}<source type="video/mp4" src={video} />{/if}</video
	>
	{#if aspectRatio && !(fitContent && has_children)}
		<div style={`width:100%;padding-top:${aspectRatio * 100 + '%'};pointer-events:none;font-size:0px;`}></div>
	{/if}
	{#if has_children && fitContent}
		<div style={FILL_STYLE}>{@render children?.()}</div>
	{/if}
	{#if has_children && !fitContent}
		<div style={OVERLAY_STYLE}>{@render children?.()}</div>
	{/if}
</div>
