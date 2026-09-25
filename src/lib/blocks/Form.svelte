<script module lang="ts">
	export type FormState = 'unsubmitted' | 'sending' | 'success' | 'error';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { get, type Writable } from 'svelte/store';
	import type { BuilderBlock, RegisteredComponents } from '../types.js';
	import { is_editing } from '../internal/env.js';
	import { all_attrs } from './helpers.js';
	import { email_submit_url, form_pairs, get_at, log_fetch, set_at } from './form.js';
	import Blocks from '../components/Blocks.svelte';

	let {
		builderContext,
		previewState = undefined,
		sendWithJs = undefined,
		sendSubmissionsTo = undefined,
		action = undefined,
		customHeaders = undefined,
		contentType = undefined,
		sendSubmissionsToEmail = undefined,
		name = undefined,
		method = undefined,
		errorMessagePath = undefined,
		resetFormOnSubmit = undefined,
		successUrl = undefined,
		validate = undefined,
		attributes = undefined,
		errorMessage = undefined,
		sendingMessage = undefined,
		successMessage = undefined,
		children
	}: {
		builderContext: Writable<Record<string, any>>;
		builderBlock?: BuilderBlock;
		builderComponents?: RegisteredComponents;
		builderLinkComponent?: unknown;
		previewState?: FormState;
		sendWithJs?: boolean;
		sendSubmissionsTo?: string;
		action?: string;
		customHeaders?: Record<string, string>;
		contentType?: string;
		sendSubmissionsToEmail?: string;
		name?: string;
		method?: string;
		errorMessagePath?: string;
		resetFormOnSubmit?: boolean;
		successUrl?: string;
		validate?: boolean;
		attributes?: Record<string, unknown>;
		errorMessage?: BuilderBlock[];
		sendingMessage?: BuilderBlock[];
		successMessage?: BuilderBlock[];
		children?: Snippet;
		[k: string]: unknown;
	} = $props();

	let form_el: HTMLFormElement | undefined;
	let form_state: FormState = $state('unsubmitted');
	let response_data: unknown = $state.raw(null);

	/** Read once: the editor frame is fixed for the page's life. */
	const editing = is_editing();
	const submission_state = $derived((editing && previewState) || form_state);

	function merge_root_state(data: Record<string, unknown>) {
		const ctx = get(builderContext);
		const combined = { ...ctx.rootState, ...data };
		if (ctx.rootSetState) ctx.rootSetState(combined);
		else
			builderContext.update((v) => {
				v.rootState = combined;
				return v;
			});
	}

	/** Dispatch on the form; true when a listener called preventDefault. */
	function emit(type: string, detail: unknown): boolean {
		if (!form_el) return false;
		const event = new CustomEvent(type, { detail });
		form_el.dispatchEvent(event);
		return event.defaultPrevented;
	}

	function on_submit(event: SubmitEvent) {
		const send_with_js = sendWithJs || sendSubmissionsTo === 'email';
		if (sendSubmissionsTo === 'zapier') {
			event.preventDefault();
			return;
		}
		if (!send_with_js) return;
		event.preventDefault();
		if (!(action || sendSubmissionsTo === 'email')) return;

		const el = (event.currentTarget || event.target) as HTMLFormElement;
		const headers: Record<string, string> = { ...customHeaders };
		// Built unconditionally, as the official does: constructing it fires the form's `formdata` event.
		const form_data = new FormData(el);
		const pairs = form_pairs(el);

		let form_content_type = sendSubmissionsTo === 'email' ? 'multipart/form-data' : contentType;
		for (const { value } of pairs) {
			if (value instanceof File || (Array.isArray(value) && value[0] instanceof File) || value instanceof FileList) {
				form_content_type = 'multipart/form-data';
			}
		}

		let body: FormData | string;
		if (form_content_type !== 'application/json') body = form_data;
		else {
			const json: Record<string, unknown> = {};
			for (const { key, value } of pairs) set_at(json, key, value);
			body = JSON.stringify(json);
		}
		// Zapier doesn't allow a content-type header from browsers.
		if (form_content_type && form_content_type !== 'multipart/form-data' && !action?.includes('zapier.com')) {
			headers['content-type'] = form_content_type;
		}

		if (emit('presubmit', { body })) return;
		form_state = 'sending';

		if (sendSubmissionsTo === 'email' && (sendSubmissionsToEmail === 'your@email.com' || !sendSubmissionsToEmail)) {
			const message = 'SubmissionsToEmail is required when sendSubmissionsTo is set to email';
			console.error(message);
			form_state = 'error';
			merge_root_state({ formErrorMessage: message });
			return;
		}

		const url =
			sendSubmissionsTo === 'email'
				? email_submit_url(get(builderContext).apiKey, sendSubmissionsToEmail, name)
				: action!;
		log_fetch(url);
		fetch(url, { body, headers, method: method || 'post' }).then(
			async (res) => {
				const res_type = res.headers.get('content-type');
				const res_body: any = res_type && res_type.indexOf('application/json') !== -1 ? await res.json() : await res.text();
				if (!res.ok) {
					if (emit('submit:error', { error: res_body, status: res.status })) return;
					response_data = res_body;
					form_state = 'error';
					let message = errorMessagePath ? get_at(res_body, errorMessagePath) : res_body.message || res_body.error || res_body;
					if (typeof message !== 'string') message = JSON.stringify(message);
					merge_root_state({ formErrorMessage: message });
					return;
				}
				response_data = res_body;
				form_state = 'success';
				if (form_el) {
					if (emit('submit:success', { res, body: res_body })) return;
					if (resetFormOnSubmit !== false) form_el.reset();
				}
				if (successUrl) {
					if (!emit('route', { url: successUrl })) location.href = successUrl;
				}
			},
			(err) => {
				if (emit('submit:error', { error: err })) return;
				response_data = err;
				form_state = 'error';
			}
		);
	}

	/** official: validate / action / method / name, then the block attributes, then the submit listener. */
	function form_attrs(): Record<string, unknown> {
		const out: Record<string, unknown> = { validate, action: !sendWithJs && action, method, name };
		const attrs = all_attrs(attributes);
		for (const key in attrs) out[key] = attrs[key];
		const user_submit = attrs.onsubmit as ((e: SubmitEvent) => void) | undefined;
		out.onsubmit = user_submit
			? (e: SubmitEvent) => {
					on_submit(e);
					user_submit(e);
				}
			: on_submit;
		return out;
	}
</script>

<form bind:this={form_el} {...form_attrs()}>
	{@render children?.()}
	{#if submission_state === 'error'}
		<Blocks path="errorMessage" blocks={errorMessage} context={builderContext} />
	{/if}
	{#if submission_state === 'sending'}
		<Blocks path="sendingMessage" blocks={sendingMessage} context={builderContext} />
	{/if}
	{#if submission_state === 'error' && response_data}
		<pre class="builder-form-error-text pre">{JSON.stringify(response_data, null, 2)}</pre>
	{/if}
	{#if submission_state === 'success'}
		<Blocks path="successMessage" blocks={successMessage} context={builderContext} />
	{/if}
</form>

<style>
	.pre {
		padding: 10px;
		color: red;
		text-align: center;
	}
</style>
