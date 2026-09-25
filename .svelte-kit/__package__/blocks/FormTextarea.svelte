<script lang="ts">
	import { all_attrs } from './helpers.js';

	let {
		attributes = undefined,
		placeholder = undefined,
		name = undefined,
		value = undefined,
		defaultValue = undefined,
		required = undefined
	}: {
		attributes?: Record<string, unknown>;
		placeholder?: string;
		name?: string;
		value?: string;
		defaultValue?: string;
		required?: boolean;
		[k: string]: unknown;
	} = $props();
</script>

<textarea {...all_attrs(attributes)} {placeholder} {name} {value} {defaultValue} {required}></textarea>
