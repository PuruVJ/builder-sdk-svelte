<script lang="ts">
	import { is_editing } from '../internal/env.js';
	import { all_attrs } from './helpers.js';

	let {
		attributes = undefined,
		defaultValue = undefined,
		placeholder = undefined,
		type = undefined,
		name = undefined,
		value = undefined,
		required = undefined
	}: {
		attributes?: Record<string, unknown>;
		defaultValue?: string;
		placeholder?: string;
		type?: string;
		name?: string;
		value?: string;
		required?: boolean;
		[k: string]: unknown;
	} = $props();

	/** Read once: the editor frame is fixed for the page's life. */
	const editing = is_editing();
</script>

<!-- In the editor, a new default value re-creates the input (official key). -->
{#key editing && defaultValue ? defaultValue : 'default-key'}
	<input {...all_attrs(attributes)} {placeholder} {type} {name} {value} {defaultValue} {required} />
{/key}
