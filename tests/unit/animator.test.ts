// @vitest-environment happy-dom
// internal/animator.ts vs the official node_modules/@builder.io/sdk-svelte/src/components/block/animator.ts.
// Both run on the same DOM (rebuilt between runs) under fake timers; every observable effect (the
// elements' inline style text, scroll listeners added / removed, warnings) is recorded at each step of
// one script of timer advances and scrolls, and the two records must be identical.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bind_animations, trigger_animation, type Animation } from '../../src/lib/internal/animator';
import { bindAnimations, triggerAnimation } from '../../node_modules/@builder.io/sdk-svelte/src/components/block/animator';

function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** `jump` moves the clock (Date.now) without running timers, as a busy main thread would. */
type Step = { advance: number } | { jump: number } | { top: number } | { height: number } | { scroll: true };
type Impl = { bind: (a: Animation[]) => void; trigger: (a: Animation) => void };
const OURS: Impl = { bind: bind_animations, trigger: trigger_animation };
const OFFICIAL: Impl = { bind: bindAnimations as unknown as Impl['bind'], trigger: triggerAnimation as unknown as Impl['trigger'] };

const HTML = '<div class="anim-a" data-i="0"></div><div class="anim-a other" data-i="1"></div><div class="anim-b" data-i="2"></div>';

/** Viewport state the mocked layout reads. */
const view = { top: 1000, height: 800 };

function set_height(h: number) {
	Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
}

function build_dom() {
	document.body.innerHTML = HTML;
	for (const el of Array.from(document.querySelectorAll('[data-i]')) as HTMLElement[]) {
		const offset = Number(el.dataset.i) * 150;
		el.getBoundingClientRect = () => {
			const top = view.top + offset;
			return { top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100, x: 0, y: top, toJSON() {} } as DOMRect;
		};
	}
}

const snapshot = () =>
	(Array.from(document.querySelectorAll('[data-i]')) as HTMLElement[]).map((el) => el.getAttribute('style') ?? '');

type Record_ = { frames: string[][]; added: number; removed: number; warns: unknown[][]; threw: string | null; steps: Animation['steps'] };

function run(impl: Impl, animations: Animation[], steps: Step[], how: 'bind' | 'trigger' = 'bind', initial_top = 1000): Record_ {
	view.top = initial_top;
	view.height = 800;
	set_height(view.height);
	build_dom();
	const listeners: EventListener[] = [];
	const add = vi.spyOn(document, 'addEventListener');
	const remove = vi.spyOn(document, 'removeEventListener');
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const frames: string[][] = [];
	let threw: string | null = null;
	const anims = structuredClone(animations);
	try {
		if (how === 'bind') impl.bind(anims);
		else for (const a of anims) impl.trigger(a);
		frames.push(snapshot());
		for (const s of steps) {
			if ('advance' in s) vi.advanceTimersByTime(s.advance);
			else if ('jump' in s) vi.setSystemTime(Date.now() + s.jump);
			else if ('top' in s) view.top = s.top;
			else if ('height' in s) set_height((view.height = s.height));
			else document.dispatchEvent(new Event('scroll'));
			frames.push(snapshot());
		}
		vi.runOnlyPendingTimers();
		frames.push(snapshot());
	} catch (e) {
		threw = (e as Error).message;
	}
	for (const c of add.mock.calls) if (c[0] === 'scroll') listeners.push(c[1] as EventListener);
	const out: Record_ = {
		frames,
		added: add.mock.calls.filter((c) => c[0] === 'scroll').length,
		removed: remove.mock.calls.filter((c) => c[0] === 'scroll' && listeners.includes(c[1] as EventListener)).length,
		warns: warn.mock.calls.map((c) => c.slice()),
		threw,
		steps: anims.flatMap((a) => a.steps)
	};
	// detach whatever is still bound, so the next run starts clean
	for (const l of listeners) document.removeEventListener('scroll', l, { capture: true } as EventListenerOptions);
	vi.clearAllTimers();
	add.mockRestore();
	remove.mockRestore();
	warn.mockRestore();
	return out;
}

const both = (animations: Animation[], steps: Step[], how: 'bind' | 'trigger' = 'bind', initial_top = 1000) => {
	const ours = run(OURS, animations, steps, how, initial_top);
	const official = run(OFFICIAL, animations, steps, how, initial_top);
	return { ours, official };
};

const page_load = (over: Partial<Animation> = {}): Animation => ({
	trigger: 'pageLoad',
	elementId: 'anim-a',
	duration: 0.5,
	delay: 0.2,
	easing: 'easeInOut',
	steps: [{ styles: { opacity: '0', transform: 'translateY(20px)' } }, { styles: { opacity: '1', transform: 'none' } }],
	...over
});

const scroll_in_view = (over: Partial<Animation> = {}): Animation => ({
	...page_load({ trigger: 'scrollInView', ...over })
});

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('pageLoad (triggerAnimation)', () => {
	const STEPS: Step[] = [{ advance: 0 }, { advance: 1 }, { advance: 500 }, { advance: 299 }, { advance: 1 }, { advance: 1000 }];

	it('same style sequence as the official', () => {
		const { ours, official } = both([page_load()], STEPS);
		expect(ours).toEqual(official);
		expect(ours.threw).toBeNull();
	});

	it('explicit sequence: none -> transition -> cleared', () => {
		const { ours } = both([page_load({ elementId: 'anim-b' })], [{ advance: 1 }, { advance: 799 }, { advance: 1 }]);
		const el = (f: string[]) => f[2];
		expect(el(ours.frames[0])).toContain('transition: none');
		expect(el(ours.frames[0])).toContain('opacity: 0');
		expect(el(ours.frames[1])).toContain('ease-in-out');
		expect(el(ours.frames[1])).toContain('transition-delay: 0.2s');
		expect(el(ours.frames[1])).toContain('opacity: 1');
		expect(el(ours.frames[3])).not.toContain('transition');
	});

	it('no delay, zero duration, every matching element', () => {
		for (const a of [page_load({ delay: undefined }), page_load({ delay: 0, duration: 0 }), page_load({ elementId: undefined, id: 'other' })])
			expect(both([a], STEPS).ours).toEqual(both([a], STEPS).official);
	});

	it('trigger_animation called directly matches triggerAnimation', () => {
		const { ours, official } = both([page_load(), page_load({ elementId: 'anim-b', delay: 1 })], STEPS, 'trigger');
		expect(ours).toEqual(official);
	});

	it('augment fills the computed value for styles a step does not set', () => {
		const a = page_load({
			steps: [{ styles: { opacity: '0' } }, { styles: { transform: 'scale(2)' } }]
		});
		const { ours, official } = both([a], STEPS);
		expect(ours).toEqual(official);
		const [first, last] = ours.steps;
		expect('transform' in first.styles).toBe(true);
		expect('opacity' in last.styles).toBe(true);
		expect(first.styles.transform).toBe(official.steps[0].styles.transform);
	});

	it('augment only touches the first and last step (three steps)', () => {
		const a = page_load({
			steps: [{ styles: { opacity: '0' } }, { styles: { color: 'red' } }, { styles: { transform: 'none' } }]
		});
		const { ours, official } = both([a], STEPS);
		expect(ours).toEqual(official);
		expect(Object.keys(ours.steps[1].styles)).toEqual(['color']);
	});

	it('missing element warns, nothing else happens', () => {
		const { ours, official } = both([page_load({ elementId: 'nope' })], STEPS);
		expect(ours).toEqual(official);
		expect(ours.warns).toEqual([['Cannot animate element: element with ID nope not found!']]);
		const none = both([page_load({ elementId: undefined, id: undefined })], STEPS);
		expect(none.ours).toEqual(none.official);
		// (happy-dom's getElementsByClassName('') matches every element, unlike browsers: only parity is checked)
	});

	it('easing strings', () => {
		for (const easing of ['linear', 'easeIn', 'easeOut', 'ease-in', 'cubic-bezier(.37,.01,0,.98)', 'EaseIn', 'ABC', 'a1B2', ''])
			expect(both([page_load({ easing })], STEPS).ours, easing).toEqual(both([page_load({ easing })], STEPS).official);
	});

	// Regression: `easing` is optional in the official BuilderAnimation type and its camelToKebabCase
	// maps undefined to '' ("all 0.5s "). Ours threw inside the timer (kebab(undefined)), leaving the
	// element at step 0 (e.g. opacity 0: invisible).
	it('undefined easing behaves like the official (no throw)', () => {
		const a = page_load({ easing: undefined as unknown as string });
		const { ours, official } = both([a], STEPS);
		expect(official.threw).toBeNull();
		expect(ours).toEqual(official);
	});

	it('unknown triggers are ignored', () => {
		for (const trigger of ['hover', undefined, '', 'PAGELOAD']) {
			const { ours, official } = both([page_load({ trigger })], STEPS);
			expect(ours).toEqual(official);
			expect(ours.frames.every((f) => f.every((s) => s === ''))).toBe(true);
		}
		expect(both([], STEPS).ours).toEqual(both([], STEPS).official);
	});
});

describe('scrollInView', () => {
	it('in view at bind: animates right away, then unbinds (repeat false)', () => {
		const steps: Step[] = [{ advance: 0 }, { advance: 1 }, { advance: 1000 }, { scroll: true }, { advance: 300 }];
		const { ours, official } = both([scroll_in_view()], steps, 'bind', 0);
		expect(ours).toEqual(official);
		expect(ours.removed).toBe(2);
		expect(ours.frames[1][0]).toContain('opacity: 1');
	});

	it('out of view at bind, scrolled in, throttled at 200 ms with leading false', () => {
		const steps: Step[] = [
			{ advance: 50 },
			{ scroll: true }, // first call: schedules for +200, does not run now (leading: false)
			{ top: 100 },
			{ advance: 100 },
			{ scroll: true }, // inside the window: no new timer
			{ advance: 99 },
			{ advance: 1 }, // the trailing call fires: in view -> triggered
			{ advance: 0 },
			{ advance: 1 },
			{ advance: 1000 },
			{ scroll: true },
			{ advance: 500 }
		];
		const { ours, official } = both([scroll_in_view({ elementId: 'anim-b' })], steps);
		expect(ours).toEqual(official);
		expect(ours.removed).toBe(1);
	});

	it('repeat true: listener stays, resets to step 0 when it leaves the view', () => {
		const steps: Step[] = [
			{ advance: 1 },
			{ advance: 1000 },
			{ top: 5000 },
			{ scroll: true },
			{ advance: 200 },
			{ scroll: true },
			{ advance: 250 },
			{ top: 0 },
			{ scroll: true },
			{ advance: 200 },
			{ advance: 1 },
			{ advance: 2000 }
		];
		const { ours, official } = both([scroll_in_view({ repeat: true })], steps, 'bind', 0);
		expect(ours).toEqual(official);
		expect(ours.removed).toBe(0);
		expect(ours.added).toBe(2); // two .anim-a elements
		const first = ours.frames.map((f) => f[0]);
		expect(first.some((f) => f.includes('opacity: 1'))).toBe(true);
		// back to step 0 after leaving the view, then in again
		const i1 = first.findIndex((f) => f.includes('opacity: 1'));
		const i0 = first.findIndex((f, i) => i > i1 && f.includes('opacity: 0'));
		expect(i0).toBeGreaterThan(i1);
		expect(first.findIndex((f, i) => i > i0 && f.includes('opacity: 1'))).toBeGreaterThan(i0);	});

	it('throttle: a call after the wait has elapsed (timer not yet run) fires at once; clock going back too', () => {
		const steps: Step[] = [
			{ scroll: true }, // schedules the trailing call
			{ top: 0 },
			{ jump: 250 }, // the clock moved past the wait but the timer has not run
			{ scroll: true }, // remaining <= 0: runs now, clears the timer
			{ advance: 1 },
			{ advance: 1000 },
			{ top: 5000 },
			{ scroll: true },
			{ jump: -1000 }, // clock went back: remaining > wait -> runs now
			{ scroll: true },
			{ advance: 500 }
		];
		const { ours, official } = both([scroll_in_view({ elementId: 'anim-b', repeat: true })], steps);
		expect(ours).toEqual(official);
		expect(ours.frames[5][2]).toContain('opacity: 1'); // triggered by the scroll after the jump (its step runs 1 ms later)
	});

	it('repeat false: the listener is removed after the first trigger', () => {
		const { ours, official } = both([scroll_in_view({ repeat: false })], [{ advance: 1 }], 'bind', 0);
		expect(ours).toEqual(official);
		expect(ours.removed).toBe(ours.added);
	});

	it('thresholdPercent and window height', () => {
		for (const thresholdPercent of [undefined, 0, 10, 50, 100]) {
			for (const top of [-200, -99, 0, 300, 700, 799, 801, 2000]) {
				const steps: Step[] = [{ advance: 10 }, { top }, { scroll: true }, { advance: 200 }, { height: 400 }, { scroll: true }, { advance: 400 }, { advance: 1000 }];
				const { ours, official } = both([scroll_in_view({ thresholdPercent, elementId: 'anim-b', repeat: true })], steps);
				expect(ours, `${thresholdPercent} ${top}`).toEqual(official);
			}
		}
	});

	it('missing element warns', () => {
		const { ours, official } = both([scroll_in_view({ elementId: 'nope' })], [{ scroll: true }]);
		expect(ours).toEqual(official);
		expect(ours.warns).toHaveLength(1);
		expect(ours.added).toBe(0);
	});

	it('listener options: capture + passive', () => {
		build_dom();
		const add = vi.spyOn(document, 'addEventListener');
		bind_animations([scroll_in_view({ elementId: 'anim-b' })]);
		expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true, passive: true });
		for (const c of add.mock.calls) document.removeEventListener('scroll', c[1] as EventListener, { capture: true } as EventListenerOptions);
	});
});

describe('seeded sweep', () => {
	it('random animations and scripts', () => {
		const rand = mulberry32(31337);
		const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
		const ids = ['anim-a', 'anim-b', 'other', 'missing'];
		const easings = ['linear', 'easeIn', 'easeInOut', 'cubic-bezier(0,0,1,1)', 'ease-out'];
		const styles = [
			{ opacity: '0' },
			{ opacity: '1' },
			{ transform: 'scale(0.5)' },
			{ opacity: '0.5', transform: 'none' },
			{},
			{ color: 'red' }
		];
		for (let i = 0; i < 120; i++) {
			const animations: Animation[] = [];
			const n = 1 + Math.floor(rand() * 2);
			for (let j = 0; j < n; j++)
				animations.push({
					trigger: pick(['pageLoad', 'scrollInView', 'scrollInView', 'hover']),
					elementId: pick(ids),
					duration: pick([0, 0.1, 0.5, 1]),
					delay: pick([undefined, 0, 0.1, 0.3]),
					easing: pick(easings),
					repeat: pick([undefined, false, true]),
					thresholdPercent: pick([undefined, 0, 20, 60]),
					steps: [{ styles: { ...pick(styles) } }, { styles: { ...pick(styles) } }]
				});
			const steps: Step[] = [];
			const m = Math.floor(rand() * 12);
			for (let k = 0; k < m; k++) {
				const r = rand();
				if (r < 0.35) steps.push({ advance: pick([0, 1, 50, 99, 100, 150, 199, 200, 201, 400, 1000]) });
				else if (r < 0.4) steps.push({ jump: pick([-500, 100, 250]) });
				else if (r < 0.7) steps.push({ scroll: true });
				else if (r < 0.9) steps.push({ top: pick([-500, -100, 0, 200, 600, 900, 3000]) });
				else steps.push({ height: pick([300, 800, 1200]) });
			}
			const { ours, official } = both(animations, steps, 'bind', pick([1000, 0, -50]));
			expect(ours, JSON.stringify({ animations, steps })).toEqual(official);
		}
	});
});
