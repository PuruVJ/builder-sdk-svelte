/** The scope context, and the official `BuilderContext` store custom components read from it. */
import { setContext } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import { SCOPE_KEY } from './keys.js';
import { official_context_key } from './official.js';
import type { Scope } from './scope.js';

const BUILDER_CONTEXT_KEY = Symbol('builder.context');

export const BuilderContext = {
	Builder: writable({
		content: null,
		context: {},
		localState: undefined,
		rootSetState() {},
		rootState: {},
		apiKey: null,
		apiVersion: undefined,
		componentInfos: {},
		inheritedStyles: {},
		BlocksWrapper: 'div',
		BlocksWrapperProps: {},
		nonce: '',
		model: ''
	}),
	/** Inside the official tree (the editor, once it has loaded) its key, so its components' context is found. */
	get key(): symbol {
		return official_context_key() ?? BUILDER_CONTEXT_KEY;
	}
};

export function provide_scope(get: () => Scope): void {
	setContext(SCOPE_KEY, get);
	const store: Writable<Record<string, unknown>> = {
		subscribe: (run, invalidate) => get().store().subscribe(run, invalidate),
		set: (value) => get().store().set(value),
		update: (fn) => get().store().update(fn)
	};
	setContext(BUILDER_CONTEXT_KEY, store);
	const official = official_context_key();
	if (official) setContext(official, store);
}
