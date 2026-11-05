/**
 * The editor bridge (official scripts/init-editing.ts + helpers/subscribe-to-editor.ts): what a page
 * inside the Builder editor says and listens to. Its own chunk — loaded only inside Builder
 * (ContentView, `subscribeToEditor`), so a visitor's page never downloads it.
 */
import type { BuilderContent, RegisteredComponent } from '../types.js';
import { is_browser } from './env.js';
import { create_register_component_message, NOT_IN_EDITOR } from './editor.js';
import { SDK_VERSION } from './track.js';


const DEFAULT_TRUSTED_HOSTS = ['*.beta.builder.io', 'beta.builder.io', 'builder.io', 'localhost', 'qa.builder.io'];

/** official `isFromTrustedHost` */
export function is_from_trusted_host(trusted_hosts: string[] | undefined, e: { origin: string }): boolean {
	if (!e.origin.startsWith('http') && !e.origin.startsWith('https')) return false;
	let hostname: string;
	try {
		hostname = new URL(e.origin).hostname;
	} catch {
		return false;
	}
	return (trusted_hosts || DEFAULT_TRUSTED_HOSTS).some((host) => (host.startsWith('*.') ? hostname.endsWith(host.slice(1)) : host === hostname));
}

const post = (message: unknown) => {
	try {
		window.parent?.postMessage(message, '*');
	} catch (err) {
		console.debug('Could not postmessage', err);
	}
};

export interface EditingOptions {
	modelName: string;
	apiKey: string | undefined;
	enrich?: boolean;
	locale?: string;
	trustedHosts?: string[];
}

let set_up = false;

/** official `setupBrowserForEditing`: tell the editor who renders, answer its `builder.evaluate` — once per page. */
export function setup_browser_for_editing(options: EditingOptions): void {
	if (set_up || !is_browser()) return;
	set_up = true;
	post({
		type: 'builder.sdkInfo',
		data: {
			target: 'svelte',
			version: SDK_VERSION,
			supportsPatchUpdates: false,
			supportsAddBlockScoping: true,
			supportsCustomBreakpoints: true,
			modelName: options.modelName,
			apiKey: options.apiKey,
			supportsXSmallBreakpoint: true,
			blockLevelPersonalization: true
		}
	});
	post({ type: 'builder.updateContent', data: { options } });
	window.addEventListener('message', (event: MessageEvent) => {
		if (!is_from_trusted_host(options.trustedHosts, event)) return;
		const data = event.data;
		if (data?.type !== 'builder.evaluate') return;
		const { text, id } = data.data ?? {};
		const args = data.data?.arguments || [];
		let result: unknown;
		let error: Error | null = null;
		try {
			result = new Function(text).apply(null, args);
		} catch (err) {
			error = err as Error;
		}
		if (error) post({ type: 'builder.evaluateError', data: { id, error: error?.message } });
		else if (result && typeof (result as Promise<unknown>).then === 'function')
			(result as Promise<unknown>).then((final) => post({ type: 'builder.evaluateResult', data: { id, result: final } })).catch(console.error);
		else post({ type: 'builder.evaluateResult', data: { result, id } });
	});
}

export interface EditorCallbacks {
	contentUpdate(content: BuilderContent, edit_type?: string): void;
	stateUpdate(state: Record<string, unknown>, edit_type?: string): void;
	animation(animation: Record<string, unknown>): void;
	configureSdk(data: { breakpoints?: NonNullable<BuilderContent['meta']>['breakpoints']; contentId?: string }): void;
}

/** official `createEditorListener`: the editor's messages for one model. */
export function editor_listener(model: string, trusted_hosts: string[] | undefined, callbacks: EditorCallbacks) {
	return (event: MessageEvent): void => {
		if (!is_from_trusted_host(trusted_hosts, event)) return;
		const data = event.data;
		if (!data || typeof data !== 'object') return;
		const message = data.data;
		switch (data.type) {
			case 'builder.configureSdk':
				if (message) callbacks.configureSdk(message);
				break;
			case 'builder.triggerAnimation':
				if (message) callbacks.animation(message);
				break;
			case 'builder.resetState':
				if (message && message.model === model && message.state) callbacks.stateUpdate(message.state, message.editType);
				break;
			case 'builder.contentUpdate': {
				if (!message) break;
				const key = message.key || message.alias || message.entry || message.modelName;
				if (key === model) callbacks.contentUpdate(message.data, message.editType);
				break;
			}
		}
	};
}

/** The registration messages for a <Content>'s components (official EnableEditor init), in registry order. */
export function post_component_infos(components: Iterable<RegisteredComponent>, model: string): void {
	for (const entry of components) {
		if ((entry as { [NOT_IN_EDITOR]?: boolean })[NOT_IN_EDITOR]) continue;
		if (entry.models?.length && !entry.models.includes(model)) continue;
		const { component: _c, ...info } = entry;
		post(create_register_component_message(info));
	}
}

/** official `subscribeToEditor`: content updates of `model` from the editor, until the returned stop. */
export function subscribe_to_editor(args: {
	model: string;
	apiKey: string;
	callback: (content: BuilderContent) => void;
	trustedHosts?: string[];
}): () => void {
	if (!is_browser()) {
		console.warn('[Builder.io]: `subscribeToEditor` only works in the browser. It currently seems to be running on the server.');
		return () => {};
	}
	setup_browser_for_editing({ modelName: args.model, apiKey: args.apiKey });
	const listener = editor_listener(args.model, args.trustedHosts, {
		contentUpdate: args.callback,
		animation() {},
		configureSdk() {},
		stateUpdate() {}
	});
	window.addEventListener('message', listener);
	return () => window.removeEventListener('message', listener);
}
