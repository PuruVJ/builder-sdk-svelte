<script lang="ts">
	import { all_attrs } from './helpers.js';
	import { stringify_styles } from '../internal/css.js';
	let {
		imgSrc = undefined,
		image = undefined,
		attributes = {},
		altText = undefined,
		title = undefined,
		backgroundSize = undefined,
		backgroundPosition = undefined,
		aspectRatio = undefined
	}: {
		imgSrc?: string;
		image?: string;
		attributes?: Record<string, any>;
		altText?: string;
		title?: string;
		backgroundSize?: string;
		backgroundPosition?: string;
		aspectRatio?: number;
		[k: string]: unknown;
	} = $props();

	function img_attrs() {
		const out = all_attrs(attributes);
		out.class = `builder-raw-img ${attributes.class || ''}`;
		delete out.style;
		return out;
	}
	// (The official computes a srcset here but never puts it on the <img>; neither do we.)
</script>

<img
	style={stringify_styles({
		objectFit: backgroundSize || 'cover',
		objectPosition: backgroundPosition || 'center',
		aspectRatio: aspectRatio || undefined,
		...(attributes?.style || {})
	})}
	loading="lazy"
	alt={altText}
	{title}
	src={imgSrc || image}
	{...img_attrs()}
/>
