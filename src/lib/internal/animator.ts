/** Block animations (official components/block/animator.ts): page-load and scroll-in-view, browser only. */
import { kebab } from './css.js';

export type Animation = {
	trigger?: string;
	id?: string;
	elementId?: string;
	duration: number;
	delay?: number;
	easing: string;
	repeat?: boolean;
	thresholdPercent?: number;
	steps: Array<{ styles: Record<string, string> }>;
};

function throttle(fn: () => void, wait: number): () => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let previous = 0;
	const later = () => {
		previous = 0;
		timeout = null;
		fn();
	};
	return () => {
		const now = Date.now();
		if (!previous) previous = now; // leading: false
		const remaining = wait - (now - previous);
		if (remaining <= 0 || remaining > wait) {
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
			previous = now;
			fn();
		} else if (!timeout) timeout = setTimeout(later, remaining);
	};
}

const assign = (style: CSSStyleDeclaration, styles: Record<string, string>) => {
	for (const key in styles) if (Object.prototype.hasOwnProperty.call(styles, key)) (style as any)[key] = styles[key];
};

function elements_of(a: Animation): HTMLElement[] {
	const id = a.elementId || a.id || '';
	const els = Array.prototype.slice.call(document.getElementsByClassName(id)) as HTMLElement[];
	if (!els.length) console.warn(`Cannot animate element: element with ID ${id} not found!`);
	return els;
}

/** official `augmentAnimation`: fill each end step with the element's computed value for every animated style. */
function augment(a: Animation, el: HTMLElement): void {
	const used: string[] = [];
	for (const step of a.steps) for (const key in step.styles) if (!used.includes(key)) used.push(key);
	const computed = getComputedStyle(el) as unknown as Record<string, string>;
	for (const styles of [a.steps[0].styles, a.steps[a.steps.length - 1].styles])
		for (const s of used) if (!(s in styles)) styles[s] = computed[s];
}

export function trigger_animation(a: Animation): void {
	for (const el of elements_of(a)) {
		augment(a, el);
		el.style.transition = 'none';
		el.style.transitionDelay = '0';
		assign(el.style, a.steps[0].styles);
		setTimeout(() => {
			el.style.transition = `all ${a.duration}s ${kebab(a.easing)}`;
			if (a.delay) el.style.transitionDelay = a.delay + 's';
			assign(el.style, a.steps[1].styles);
			setTimeout(() => {
				el.style.transition = '';
				el.style.transitionDelay = '';
			}, (a.delay || 0) * 1000 + a.duration * 1000 + 100);
		});
	}
}

function bind_scroll_in_view(a: Animation): void {
	for (const el of elements_of(a)) {
		augment(a, el);
		let triggered = false;
		let pending = false;
		const in_view = () => {
			const rect = el.getBoundingClientRect();
			const h = window.innerHeight;
			const threshold = ((a.thresholdPercent || 0) / 100) * h;
			return rect.bottom > threshold && rect.top < h - threshold;
		};
		const on_scroll_now = () => {
			if (!triggered && in_view()) {
				triggered = true;
				pending = true;
				setTimeout(() => {
					assign(el.style, a.steps[1].styles);
					if (!a.repeat) document.removeEventListener('scroll', on_scroll);
					setTimeout(
						() => {
							pending = false;
							if (!a.repeat) {
								el.style.transition = '';
								el.style.transitionDelay = '';
							}
						},
						(a.duration + (a.delay || 0)) * 1000 + 100
					);
				});
			} else if (a.repeat && triggered && !pending && !in_view()) {
				triggered = false;
				assign(el.style, a.steps[0].styles);
			}
		};
		const on_scroll = throttle(on_scroll_now, 200);
		assign(el.style, a.steps[0].styles);
		setTimeout(() => {
			el.style.transition = `all ${a.duration}s ${kebab(a.easing)}`;
			if (a.delay) el.style.transitionDelay = a.delay + 's';
		});
		document.addEventListener('scroll', on_scroll, { capture: true, passive: true });
		on_scroll_now();
	}
}

export function bind_animations(animations: Animation[]): void {
	for (const a of animations) {
		if (a.trigger === 'pageLoad') trigger_animation(a);
		else if (a.trigger === 'scrollInView') bind_scroll_in_view(a);
	}
}
