// Block animations in the browser, the official build against ours (and ours in Svelte's async mode):
// pageLoad (start step, transition, end step), scrollInView (nothing until scrolled into view; a
// repeating one resets when scrolled away), hover (the CSS :hover rule), and builder.triggerAnimation
// sent by the editor. The same inline styles at every checkpoint.
// Pages: e2e/app/src/routes/client-animations, the official /animations and /hover-animation specs.
// Needs `pnpm build && pnpm e2e:build` (+ `pnpm e2e:build:async` for the ours-async runs).
import { afterAll, beforeAll, describe, expect } from 'vitest';
import type { Frame, Page } from 'playwright';
import { differential, in_editor, open_page, pair_built, serve, until, type Servers } from './client-harness.js';

let servers: Servers;
const get = () => servers;

/** A block's inline style (sorted declarations) and computed opacity / transform / colours. */
const look = (page: Page | Frame, id: string) =>
	page.evaluate((id) => {
		const el = document.querySelector(`[builder-id="builder-${id}"]`) as HTMLElement;
		const cs = getComputedStyle(el);
		return {
			inline: el.style.cssText.split(';').map((s) => s.trim()).filter(Boolean).sort(),
			opacity: Number(cs.opacity),
			transform: cs.transform,
			background: cs.backgroundColor,
			color: cs.color
		};
	}, id);
const settled = (page: Page | Frame, id: string, opacity: number) =>
	until(async () => {
		const l = await look(page, id);
		return l.opacity === opacity && !l.inline.some((d) => d.startsWith('transition')) && l;
	}, 5000, `${id} settled at opacity ${opacity}`);

describe.skipIf(!pair_built)('animations behave the same in the browser', () => {
	beforeAll(async () => {
		servers = await serve(4510);
	});
	afterAll(async () => {
		await servers?.close();
	});

	differential(get, 'pageLoad: the start step, a transition, the end step', async (sdk) => {
		const { context, page, problems } = await open_page(servers, sdk, '/client-animations', { context_options: { viewport: { width: 1000, height: 700 } } });
		// mid-animation (0.6s + 0.1s delay): not there yet, a transition running
		const during = await look(page, 'load');
		expect(during.opacity).toBeLessThan(1);
		const end = await settled(page, 'load', 1);
		expect(end.inline).toEqual(['opacity: 1', 'transform: none']);
		expect(problems.errors).toEqual([]);
		await context.close();
		return { during_inline_keys: during.inline.map((d) => d.split(':')[0]).sort(), end };
	});

	differential(get, 'scrollInView: start step until scrolled into view, then the end step; repeat resets', async (sdk) => {
		const { context, page, problems } = await open_page(servers, sdk, '/client-animations', { context_options: { viewport: { width: 1000, height: 700 } } });
		const steps: unknown[] = [];
		await until(async () => (await look(page, 'scroll')).inline.includes('opacity: 0'), 5000, 'the start step');
		await page.waitForTimeout(400);
		const before = await look(page, 'scroll');
		expect(before.opacity).toBe(0); // far below the fold: still the start step
		steps.push(before);
		await page.evaluate(() => document.querySelector('[builder-id="builder-scroll"]')!.scrollIntoView({ block: 'center' }));
		steps.push(await settled(page, 'scroll', 1));
		// the repeating one: in, out (back to the start step), in again
		// (a repeating animation keeps its transition)
		await page.evaluate(() => document.querySelector('[builder-id="builder-scroll-repeat"]')!.scrollIntoView({ block: 'center' }));
		steps.push(await until(async () => (await look(page, 'scroll-repeat')).opacity === 1 && look(page, 'scroll-repeat'), 5000, 'repeat in view'));
		await page.waitForTimeout(400);
		await page.evaluate(() => window.scrollTo(0, 0));
		// (computed opacity: wait for each transition to finish, not just for the inline style)
		await until(async () => {
			const l = await look(page, 'scroll-repeat');
			return l.inline.includes('opacity: 0') && l.opacity === 0;
		}, 5000, 'reset when scrolled away');
		steps.push((await look(page, 'scroll-repeat')).inline);
		await page.evaluate(() => document.querySelector('[builder-id="builder-scroll-repeat"]')!.scrollIntoView({ block: 'center' }));
		await until(async () => {
			const l = await look(page, 'scroll-repeat');
			return l.inline.includes('opacity: 1') && l.opacity === 1;
		}, 5000, 'in again');
		steps.push((await look(page, 'scroll-repeat')).inline.filter((d) => !d.startsWith('transition')));
		// the non-repeating one stays at its end step
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(400);
		steps.push(await look(page, 'scroll'));
		expect(problems.errors).toEqual([]);
		await context.close();
		return steps;
	});

	differential(get, 'hover: the :hover step applies while hovered, and goes', async (sdk) => {
		const { context, page, problems } = await open_page(servers, sdk, '/client-animations');
		const steps: unknown[] = [await look(page, 'hover')];
		await page.hover('[builder-id="builder-hover"]');
		steps.push(await until(async () => (await look(page, 'hover')).background === 'rgb(10, 200, 30)' && look(page, 'hover'), 5000, 'hovered'));
		await page.mouse.move(0, 0);
		steps.push(await until(async () => (await look(page, 'hover')).background === 'rgb(0, 0, 0)' && look(page, 'hover'), 5000, 'unhovered'));
		// the official /hover-animation spec: a Button
		await page.goto(servers.origin(sdk) + '/hover-animation');
		const button = page.locator('button');
		await until(async () => (await button.evaluate((b) => getComputedStyle(b).backgroundColor)) === 'rgb(0, 0, 0)', 5000, 'black');
		await button.hover();
		await until(async () => (await button.evaluate((b) => getComputedStyle(b).backgroundColor)) === 'rgb(149, 79, 79)', 5000, 'hover colour');
		steps.push(await button.evaluate((b) => [getComputedStyle(b).transitionDuration, getComputedStyle(b).transitionTimingFunction]));
		expect(problems.errors).toEqual([]);
		await context.close();
		return steps;
	});

	differential(get, '/animations (official spec): pageLoad and scrollInView blocks get the transition', async (sdk) => {
		const { context, page, problems } = await open_page(servers, sdk, '/animations');
		const css = (sel: string) => page.locator(sel).evaluate((e) => [getComputedStyle(e).transition, (e as HTMLElement).style.cssText.split(';').map((s) => s.trim()).filter(Boolean).sort()]);
		const text = '[builder-id="builder-6ccfdba788cf4a70bfddd9a91248f456"]';
		const img = '[builder-id="builder-3cb8a3c70fea46ec99a57b336a66320c"]';
		await until(async () => (await css(text))[0] === '30s cubic-bezier(0, 1.61, 0, 1.15)', 5000, 'the text transition');
		await until(async () => (await css(img))[0] === '30s cubic-bezier(0, 1.61, 0, 1.15)', 5000, 'the image transition');
		const result = [await css(text), await css(img)];
		expect(problems.errors).toEqual([]);
		await context.close();
		return result;
	});

	differential(get, 'builder.triggerAnimation from the editor animates the block it names', async (sdk) => {
		const editor = await in_editor(servers, sdk, '/client-animations');
		const { frame, page, problems } = editor;
		await frame.waitForSelector('[builder-id="builder-target"]');
		await page.waitForTimeout(300);
		const before = await look(frame, 'target');
		await editor.post({
			type: 'builder.triggerAnimation',
			data: {
				elementId: 'builder-target',
				trigger: 'pageLoad',
				steps: [{ styles: { opacity: '0.2', transform: 'scale(0.5)' } }, { styles: { opacity: '0.9', transform: 'none' } }],
				duration: 0.3,
				delay: 0,
				easing: 'linear'
			}
		});
		await until(async () => (await look(frame, 'target')).inline.includes('opacity: 0.2') || (await look(frame, 'target')).inline.includes('opacity: 0.9'), 5000, 'the animation started');
		const end = await settled(frame, 'target', 0.9);
		expect(end.inline).toEqual(['opacity: 0.9', 'transform: none']);
		expect(problems.errors).toEqual([]);
		await editor.context.close();
		return { before, end };
	});
});

