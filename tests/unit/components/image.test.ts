// Image (official blocks/image/image.svelte + image.helpers.ts): srcset for Builder / Shopify / other
// URLs, webp, aspectRatio, fitContent, background size/position, priority, alt, sizes, children.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, lines, page, setup, teardown, text } from './harness.js';
import { get_srcset } from '../../../src/lib/blocks/image.js';

beforeAll(setup);
afterAll(teardown);

const CDN = 'https://cdn.builder.io/api/v1/image/assets%2Fabc%2Fdef';
const CDN_W = CDN + '?width=640';
const CDN_Q = CDN + '?quality=60&format=png';
const SHOPIFY = 'https://cdn.shopify.com/s/files/1/products/shirt.jpg?v=123';
const OTHER = 'https://images.example.com/pic.png';
const kids = [text('over', '<p>overlay</p>')];

const image = (options: Record<string, unknown>, rest: Record<string, unknown> = {}) => page([comp('img', 'Image', options, rest)]);

describe('Image', () => {
	each_case(it, {
		'builder cdn': { content: image({ image: CDN }) },
		'builder cdn with a width': { content: image({ image: CDN_W }) },
		'builder cdn with a query': { content: image({ image: CDN_Q }) },
		'builder cdn, noWebp': { content: image({ image: CDN, noWebp: true }) },
		'builder cdn, own srcset of the same image': { content: image({ image: CDN, srcset: `${CDN}?width=100 100w` }) },
		'builder cdn, own srcset of another image': { content: image({ image: CDN, srcset: 'https://cdn.builder.io/api/v1/image/other 100w' }) },
		'shopify': { content: image({ image: SHOPIFY }) },
		'shopify, noWebp': { content: image({ image: SHOPIFY, noWebp: true }) },
		'other url': { content: image({ image: OTHER }) },
		'other url with srcset': { content: image({ image: OTHER, srcset: `${OTHER} 1x, ${OTHER}?2 2x` }) },
		'src instead of image': { content: image({ src: CDN }) },
		'no image': { content: image({}) },
		'relative url': { content: image({ image: '/pic.png' }) },
		aspectRatio: { content: image({ image: CDN, aspectRatio: 0.5625 }) },
		'aspectRatio 0': { content: image({ image: CDN, aspectRatio: 0 }) },
		fitContent: { content: image({ image: CDN, fitContent: true, aspectRatio: 1 }) },
		'backgroundSize contain': { content: image({ image: CDN, backgroundSize: 'contain' }) },
		'backgroundPosition top left': { content: image({ image: CDN, backgroundPosition: 'top left' }) },
		'lazy (default) vs highPriority': { content: image({ image: CDN, highPriority: true }) },
		'lazy option (no effect)': { content: image({ image: CDN, lazy: true }) },
		altText: { content: image({ image: CDN, altText: 'A cat' }) },
		title: { content: image({ image: CDN, title: 'Title' }) },
		className: { content: image({ image: CDN, className: 'pic' }) },
		sizes: { content: image({ image: CDN, sizes: '(max-width: 600px) 100vw, 50vw' }) },
		'height and width': { content: image({ image: CDN, height: 300, width: 400 }) },
		'children overlay': { content: image({ image: CDN, aspectRatio: 0.5 }, { children: kids }) },
		'children with fitContent': { content: image({ image: CDN, aspectRatio: 0.5, fitContent: true }, { children: kids }) },
		'children, no aspect ratio': { content: image({ image: CDN }, { children: kids }) },
		'block styles': { content: image({ image: CDN }, { responsiveStyles: { large: { width: '50%' }, small: { width: '100%' } } }) },
		'bound image': { content: page([comp('img', 'Image', {}, { bindings: { 'component.options.image': 'state.src' } })], { state: { src: CDN } }) }
	});

	it('ours: a builder image gets a width srcset and a webp source', () => {
		const c = check({ content: image({ image: CDN }) });
		const img = lines(c.ours, /<img/)[0];
		expect(img).toContain(`srcset="${CDN}?width=100 100w`);
		expect(img).toContain('loading="lazy"');
		expect(img).toContain('role="presentation"');
		expect(lines(c.ours, /<source/)[0]).toContain('type="image/webp"');
	});

	it('ours: another host keeps the image as its own srcset and gets no webp source', () => {
		const c = check({ content: image({ image: OTHER }) });
		expect(lines(c.ours, /<source/)).toEqual([]);
		expect(lines(c.ours, /<img/)[0]).not.toContain('srcset=');
	});

	it('srcset: builder, with a width in the url, shopify, other', () => {
		expect(get_srcset(CDN).split(', ')).toHaveLength(8);
		expect(get_srcset(CDN_W)).toContain(`${CDN_W} 640w`);
		expect(get_srcset(SHOPIFY)).toContain('_100x100.jpg');
		expect(get_srcset(OTHER)).toBe(OTHER);
		expect(get_srcset('')).toBe('');
	});
});
