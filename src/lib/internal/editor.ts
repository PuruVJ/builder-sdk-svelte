/** Editor-facing registration: the official functions, message for message. */
import { is_browser } from './env.js';

const ARROW_WITHOUT_PARENS = /^[a-zA-Z0-9_]+\s*=>/i;

const serialize_fn = (fn: Function) => {
	const str = fn.toString().trim();
	const arrow_without_parens = ARROW_WITHOUT_PARENS.test(str);
	const prefix = !str.startsWith('function') && !str.startsWith('async') && !str.startsWith('(') && !arrow_without_parens;
	return `return (${prefix ? 'function ' : ''}${str}).apply(this, arguments)`;
};

export function serialize_including_functions<T>(info: T): T {
	return JSON.parse(JSON.stringify(info, (_key, value) => (typeof value === 'function' ? serialize_fn(value) : value)));
}

export const create_register_component_message = (info: unknown) => ({
	type: 'builder.registerComponent',
	data: serialize_including_functions(info)
});

const registry: Record<string, unknown[]> = {};

export function register(type: string, info: any): void {
	if (type === 'plugin') info = serialize_including_functions(info);
	(registry[type] ??= []).push(info);
	if (is_browser()) {
		const message = { type: 'builder.register', data: { type, info } };
		try {
			parent.postMessage(message, '*');
			if (parent !== window) window.postMessage(message, '*');
		} catch (err) {
			console.debug('Could not postmessage', err);
		}
	}
}

export function register_action(action: any): void {
	if (is_browser()) {
		const clone = JSON.parse(JSON.stringify(action));
		if (action.action) clone.action = action.action.toString();
		window.parent?.postMessage({ type: 'builder.registerAction', data: clone }, '*');
	}
}

const settings: Record<string, unknown> = {};

export function set_editor_settings(next: Record<string, unknown>): void {
	if (is_browser()) {
		Object.assign(settings, next);
		parent.postMessage({ type: 'builder.settingsChange', data: settings }, '*');
	}
}
