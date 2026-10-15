<script lang="ts">
	// test-only: tests/editor-parity.test.ts — what the editor receives, and what custom components read
	import { Content, register, registerAction, setEditorSettings } from '@builder.io/sdk-svelte';
	import Ctx from './Ctx.svelte';

	register('insertMenu', { name: 'Test menu', items: [{ name: 'Ctx' }] });
	setEditorSettings({ customInsertMenu: true });
	registerAction({ name: 'Test action', kind: 'function', id: 'test-action', inputs: [], action: () => 'return 1' });

	const content = {
		id: 'editor-test',
		data: {
			blocks: [
				{
					'@type': '@builder.io/sdk:Element',
					id: 'builder-ctx',
					component: { name: 'Ctx', options: { label: 'ctx block' } }
				}
			]
		}
	};
	const header = {
		id: 'header-test',
		data: {
			blocks: [
				{
					'@type': '@builder.io/sdk:Element',
					id: 'builder-header-ctx',
					component: { name: 'Ctx', options: { label: 'header block' } }
				}
			]
		}
	};
	const components = [
		{
			name: 'Ctx',
			component: Ctx,
			inputs: [
				{ name: 'on', type: 'boolean' },
				{ name: 'label', type: 'string', showIf: (options: { get(k: string): unknown }) => options.get('on') === true }
			]
		}
	];
</script>

<Content model="header" apiKey="test" canTrack={false} content={header} customComponents={components as never} />
<Content model="page" apiKey="test" canTrack={false} {content} customComponents={components as never} />
