// Video (official blocks/video/video.svelte): every option.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, lines, page, setup, teardown, text } from './harness.js';

beforeAll(setup);
afterAll(teardown);

const SRC = 'https://cdn.builder.io/o/assets%2Fvideo.mp4?alt=media';
const kids = [text('over', '<p>on the video</p>')];
const video = (options: Record<string, unknown>, rest: Record<string, unknown> = {}) => page([comp('vid', 'Video', { video: SRC, ...options }, rest)]);

describe('Video', () => {
	each_case(it, {
		default: { content: video({}) },
		'no video': { content: page([comp('vid', 'Video', {})]) },
		autoPlay: { content: video({ autoPlay: true }) },
		'autoPlay false': { content: video({ autoPlay: false }) },
		muted: { content: video({ muted: true }) },
		controls: { content: video({ controls: true }) },
		loop: { content: video({ loop: true }) },
		playsInline: { content: video({ playsInline: true }) },
		'every flag': { content: video({ autoPlay: true, muted: true, controls: true, loop: true, playsInline: true }) },
		'preload auto': { content: video({ preload: 'auto' }) },
		'preload none': { content: video({ preload: 'none' }) },
		lazyLoad: { content: video({ lazyLoad: true, preload: 'auto' }) },
		posterImage: { content: video({ posterImage: 'https://cdn.builder.io/api/v1/image/poster' }) },
		'fit contain': { content: video({ fit: 'contain' }) },
		'fit cover, position top': { content: video({ fit: 'cover', position: 'top' }) },
		aspectRatio: { content: video({ aspectRatio: 0.5625 }) },
		'aspectRatio 0': { content: video({ aspectRatio: 0 }) },
		'width and height': { content: video({ width: 640, height: 360 }) },
		'children overlay': { content: video({ aspectRatio: 0.5 }, { children: kids }) },
		'children, fitContent': { content: video({ aspectRatio: 0.5, fitContent: true }, { children: kids }) },
		'fitContent, no children': { content: video({ aspectRatio: 0.5, fitContent: true }) },
		'an attributes option with a style': { content: video({ attributes: { style: { borderRadius: '8px', opacity: 0.5 } } }) },
		'block styles': { content: video({}, { responsiveStyles: { large: { maxWidth: '600px' } }, properties: { class: 'v' } }) },
		'bound autoplay': { content: page([comp('vid', 'Video', { video: SRC }, { bindings: { 'component.options.autoPlay': 'state.play' } })], { state: { play: true } }) }
	});

	it('ours: a lazy video defers its source and preloads nothing', () => {
		const c = check({ content: video({ lazyLoad: true, preload: 'auto' }) });
		expect(lines(c.ours, /<video/)[0]).toContain('preload="none"');
		expect(lines(c.ours, /<source/)[0]).toContain(`data-src="${SRC}"`);
		expect(lines(c.ours, /<source/)[0]).not.toContain(' src=');
	});

	it('ours: flags are boolean attributes, the default preload is metadata', () => {
		const c = check({ content: video({ autoPlay: true, muted: true }) });
		const v = lines(c.ours, /<video/)[0];
		expect(v).toContain('autoplay=""');
		expect(v).toContain('muted=""');
		expect(v).toContain('preload="metadata"');
		expect(v).not.toContain('loop');
	});
});
