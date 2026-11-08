<script lang="ts">
	// The counted client bench's root: <Content> with a content the bench can replace (`set`), the way
	// a client navigation or a live edit hands the SDK a new content.
	import { Content } from '../../src/lib/index.js';

	let { initial, components }: { initial: unknown; components: unknown[] } = $props();
	// svelte-ignore state_referenced_locally
	let content = $state.raw(initial);
	export function set(next: unknown) {
		content = next;
	}
</script>

<Content {content} model="page" apiKey="bench" customComponents={components as never} canTrack={false} />
