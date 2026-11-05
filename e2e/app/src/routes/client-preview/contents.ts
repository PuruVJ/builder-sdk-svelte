// test-only: tests/client-preview.test.ts — the published contents, and the drafts its preview
// fetches are answered with
const ELEMENT = '@builder.io/sdk:Element';
const text = (id: string, html: string) => ({ '@type': ELEMENT, id: `builder-${id}`, component: { name: 'Text', options: { text: html } } });
const symbol = (inner: string) => ({
	'@type': ELEMENT,
	id: 'builder-sym',
	component: {
		name: 'Symbol',
		options: { symbol: { model: 'symbol', entry: 'sym-entry', data: {}, content: { id: 'sym-entry', data: { blocks: [text('sym-text', `<p data-sym>${inner}</p>`)] } } } }
	}
});

export const PREVIEW_PAGE = { id: 'preview-page', data: { blocks: [text('page-text', '<p data-page>published page</p>'), symbol('published symbol')] } };
export const PREVIEW_HEADER = { id: 'preview-header', data: { blocks: [text('header-text', '<p data-header>published header</p>')] } };

export const DRAFTS: Record<string, unknown> = {
	page: { id: 'preview-page', data: { blocks: [text('page-text', '<p data-page>draft page</p>'), symbol('published symbol')] } },
	header: { id: 'preview-header', data: { blocks: [text('header-text', '<p data-header>draft header</p>')] } },
	symbol: { id: 'sym-entry', data: { blocks: [text('sym-text', '<p data-sym>draft symbol</p>')] } }
};
