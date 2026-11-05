// test-only: tests/editor-fuzz.test.ts — contents the test POSTs, rendered fresh by key (?c=<key>).
// One Node process serves the app, so a module-level Map is shared by the endpoint and the page load.
const contents = new Map<string, unknown>();

export const put = (key: string, content: unknown) => contents.set(key, content);
export const get = (key: string | null) => (key === null ? undefined : contents.get(key));

/** Shown when no key is given: a page that renders, so the route works by hand too. */
export const DEFAULT_CONTENT = {
	id: 'editor-fuzz',
	data: {
		state: { title: 'Title from state', flag: true, color: 'rgb(200, 0, 0)' },
		blocks: [
			{
				'@type': '@builder.io/sdk:Element',
				id: 'builder-fz-default-text',
				component: { name: 'Text', options: { text: '<p>editor fuzz</p>' } }
			},
			{
				'@type': '@builder.io/sdk:Element',
				id: 'builder-fz-default-counter',
				component: { name: 'Counter', options: { label: 'default counter' } }
			}
		]
	}
};
