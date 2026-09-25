/** Image srcset (official blocks/image/image.helpers.ts) — regexes hoisted, results memoised per URL. */

const PROTOCOL_RE = /http(s)?:/;
const WIDTH_PARAM_RE = /([?&])width=.*?(&|$)/i;
const BUILDER_RE = /builder\.io/;
const SHOPIFY_RE = /cdn\.shopify\.com/;
const SHOPIFY_SIZE_RE = /(_\d+x(\d+)?)?(\.(jpg|jpeg|gif|png|bmp|bitmap|tiff|tif)(\?v=\d+)?)/i;
const QUERY_RE = /\?/g;
const SIZES = [100, 200, 400, 800, 1200, 1600, 2000];

const remove_protocol = (path: string) => path.replace(PROTOCOL_RE, '');

function with_width(uri: string, value: number): string {
	if (WIDTH_PARAM_RE.test(uri)) return uri.replace(WIDTH_PARAM_RE, '$1width=' + encodeURIComponent(value) + '$2');
	return uri + (uri.indexOf('?') !== -1 ? '&' : '?') + 'width=' + encodeURIComponent(value);
}

function shopify_url(src: string, size: string): string | null {
	if (!src || !SHOPIFY_RE.test(src) || !size) return src;
	if (size === 'master') return remove_protocol(src);
	const match = src.match(SHOPIFY_SIZE_RE);
	if (!match) return null;
	const prefix = src.split(match[0]);
	const use_size = size.includes('x') ? size : `${size}x`;
	return remove_protocol(`${prefix[0]}_${use_size}${match[3]}`);
}

const srcset_cache = new Map<string, string>();
const MAX = 2000;

export function get_srcset(url: string): string {
	if (!url) return url;
	let out = srcset_cache.get(url);
	if (out !== undefined) return out;
	if (BUILDER_RE.test(url)) {
		let src_url = url;
		const width_in_src = Number(url.split('?width=')[1]);
		if (!isNaN(width_in_src)) src_url = `${src_url} ${width_in_src}w`;
		out = SIZES.filter((s) => s !== width_in_src)
			.map((s) => `${with_width(url, s)} ${s}w`)
			.concat([src_url])
			.join(', ');
	} else if (SHOPIFY_RE.test(url)) {
		out = SIZES.map((s) => [shopify_url(url, `${s}x${s}`), s] as const)
			.filter(([u]) => !!u)
			.map(([u, s]) => `${u} ${s}w`)
			.concat([url])
			.join(', ');
	} else out = url;
	if (srcset_cache.size >= MAX) srcset_cache.delete(srcset_cache.keys().next().value!);
	srcset_cache.set(url, out);
	return out;
}

export const is_builder_or_shopify = (url: string) => BUILDER_RE.test(url) || SHOPIFY_RE.test(url);
export const is_builder = (url: string) => BUILDER_RE.test(url);
export const to_webp = (srcset: string) => srcset.replace(QUERY_RE, '?format=webp&');
