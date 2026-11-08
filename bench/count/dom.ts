/**
 * Preload of the counted client bench: a DOM (happy-dom, loaded before counting starts, so its own
 * work is not counted: the steps are the SDK's and Svelte's, not the fake browser's).
 *   heisenbench run bench/count/client.bench.ts --svelte client --conditions svelte --import bench/count/dom.ts
 */
import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost/' });
const g = globalThis as Record<string, unknown>;
const GLOBALS = [
	'window', 'document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment', 'DocumentFragment', 'HTMLTemplateElement',
	'Event', 'CustomEvent', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'getComputedStyle',
	'requestAnimationFrame', 'cancelAnimationFrame', 'location', 'history', 'localStorage', 'sessionStorage', 'matchMedia',
	'innerWidth', 'innerHeight', 'addEventListener', 'removeEventListener', 'dispatchEvent', 'parent', 'top', 'self',
	'HTMLImageElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLAnchorElement', 'SVGElement'
];
for (const key of GLOBALS) g[key] = (window as unknown as Record<string, unknown>)[key];
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
