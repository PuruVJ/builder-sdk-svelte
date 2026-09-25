<script lang="ts">
	import { is_editing } from '../internal/env.js';
	import { all_attrs } from './helpers.js';

	let {
		attributes = undefined,
		value = undefined,
		defaultValue = undefined,
		name = undefined,
		required = undefined,
		options = undefined
	}: {
		attributes?: Record<string, unknown>;
		value?: string;
		defaultValue?: string;
		name?: string;
		required?: boolean;
		options?: { name?: string; value: string }[];
		[k: string]: unknown;
	} = $props();

	/** Read once: the editor frame is fixed for the page's life. */
	const editing = is_editing();
</script>

<!-- In the editor, a new default value re-creates the select (official key). -->
{#key editing && defaultValue ? defaultValue : 'default-key'}
	<select {...all_attrs(attributes)} {value} {defaultValue} {name} {required}>
		{#each options ?? [] as option}
			<option value={option.value}>{option.name || option.value}</option>
		{/each}
	</select>
{/key}
