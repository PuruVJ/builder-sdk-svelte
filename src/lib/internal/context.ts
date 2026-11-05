/** The scope context, and the official `BuilderContext` store custom components read from it. */
import { setContext } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import { SCOPE_KEY } from './keys.js';
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
	key: BUILDER_CONTEXT_KEY
};

export function provide_scope(get: () => Scope): void {
	setContext(SCOPE_KEY, get);
	const store: Writable<Record<string, unknown>> = {
		subscribe: (run, invalidate) => get().store().subscribe(run, invalidate),
		set: (value) => get().store().set(value),
		update: (fn) => get().store().update(fn)
	};
	setContext(BUILDER_CONTEXT_KEY, store);
}
