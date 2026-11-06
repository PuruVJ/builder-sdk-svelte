<script lang="ts">
	// test-only: tests/editor-empty-blocks.test.ts — empty block lists ("+ Add Block") in the editor:
	// an empty custom-component slot, an empty column, and the same under a non-div blocks wrapper
	import { Content } from '@builder.io/sdk-svelte';
	import Tab from './Tab.svelte';

	const el = (id: string, rest: Record<string, unknown>) => ({ '@type': '@builder.io/sdk:Element', id, ...rest });
	const blocks = (prefix: string) => [
		el(`builder-${prefix}-tab`, { component: { name: 'Tab', options: { content: [] } } }),
		el(`builder-${prefix}-full-tab`, {
			component: { name: 'Tab', options: { content: [el(`builder-${prefix}-text`, { component: { name: 'Text', options: { text: 'filled' } } })] } }
		}),
		el(`builder-${prefix}-cols`, { component: { name: 'Columns', options: { columns: [{ blocks: [] }, { blocks: [el(`builder-${prefix}-c`, { component: { name: 'Text', options: { text: 'col' } } })] }] } } })
	];
	const page = { id: 'empty-blocks', data: { blocks: blocks('p') } };
	const other = { id: 'empty-blocks-section', data: { blocks: blocks('s') } };
	const components = [{ name: 'Tab', component: Tab, shouldReceiveBuilderProps: { builderBlock: true }, inputs: [{ name: 'content', type: 'uiBlocks' }] }];
</script>

<Content model="page" apiKey="test" canTrack={false} content={page} customComponents={components as never} />
<Content model="other" apiKey="test" canTrack={false} content={other} customComponents={components as never} blocksWrapper="section" />
