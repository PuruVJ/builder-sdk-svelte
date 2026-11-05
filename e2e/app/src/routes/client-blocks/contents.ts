// test-only: tests/client-interactions.test.ts — the built-in blocks' client behaviour, one content per
// `?c=<name>` (forms, media below the fold, collapsible tabs, a lazyLoad section).
const ELEMENT = '@builder.io/sdk:Element';
type Block = Record<string, unknown>;

/** (the default block styles the Builder editor gives every block) */
const LARGE = { display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: '0', boxSizing: 'border-box' };
const el = (id: string, name: string, options: Record<string, unknown> = {}, extra: Block = {}): Block => ({
	'@type': ELEMENT,
	'@version': 2,
	id: `builder-${id}`,
	component: { name, options },
	...extra,
	responsiveStyles: { large: { ...LARGE, ...(extra.responsiveStyles as { large?: object } | undefined)?.large } }
});
const text = (id: string, html: string, extra: Block = {}) => el(id, 'Text', { text: html }, extra);

/** One form, every field kind; its messages are Text blocks (the error one reads root state). */
function form(id: string, options: Record<string, unknown>): Block {
	return el(
		id,
		'Form:Form',
		{
			successMessage: [text(`${id}-ok`, `<p data-msg="${id}-success">${id} success</p>`)],
			errorMessage: [text(`${id}-err`, `<p data-msg="${id}-error">${id} error: {{state.formErrorMessage}}</p>`)],
			sendingMessage: [text(`${id}-sending`, `<p data-msg="${id}-sending">${id} sending</p>`)],
			...options
		},
		{
			children: [
				el(`${id}-name`, 'Form:Input', { name: 'name', type: 'text', placeholder: 'Jane', required: true }),
				el(`${id}-email`, 'Form:Input', { name: 'email', type: 'email', placeholder: 'jane@doe.com' }),
				el(`${id}-age`, 'Form:Input', { name: 'age', type: 'number' }),
				el(`${id}-agree`, 'Form:Input', { name: 'agree', type: 'checkbox' }),
				el(`${id}-color`, 'Form:Select', {
					name: 'color',
					options: [
						{ name: 'Red', value: 'red' },
						{ name: 'Blue', value: 'blue' }
					],
					defaultValue: 'red'
				}),
				el(`${id}-details`, 'Form:TextArea', { name: 'details', placeholder: 'Hello' }),
				el(`${id}-submit`, 'Form:SubmitButton', { text: `Submit ${id}` })
			]
		}
	);
}

const FORMS = {
	id: 'client-forms',
	data: {
		blocks: [
			form('json', { name: 'json', sendWithJs: true, action: '/__submit/ok?kind=json', contentType: 'application/json', customHeaders: { 'x-test': 'json' } }),
			form('urlenc', { name: 'urlenc', sendWithJs: true, action: '/__submit/ok?kind=urlenc', method: 'PUT', contentType: 'application/x-www-form-urlencoded' }),
			form('fail', { name: 'fail', sendWithJs: true, action: '/__submit/fail', contentType: 'application/json', errorMessagePath: 'detail.msg' }),
			form('noreset', { name: 'noreset', sendWithJs: true, action: '/__submit/ok?kind=noreset', contentType: 'application/json', resetFormOnSubmit: false }),
			form('email', { name: 'My form', sendSubmissionsTo: 'email', sendSubmissionsToEmail: 'me@example.com' })
		]
	}
};

const IMG = 'https://cdn.builder.io/api/v1/image/assets%2Fclienttest%2F';
const VIDEO = 'https://cdn.builder.io/o/assets%2Fclienttest%2F';
const SPACER = (id: string) => text(id, '<p>spacer</p>', { responsiveStyles: { large: { height: '9000px' } } });

const MEDIA = {
	id: 'client-media',
	data: {
		blocks: [
			el('img-top', 'Image', { image: IMG + 'top', aspectRatio: 0.5, sizes: '100vw' }),
			el('img-priority', 'Image', { image: IMG + 'priority?width=300', highPriority: true, aspectRatio: 0.5 }),
			el('video-top', 'Video', { video: VIDEO + 'top?alt=media', autoPlay: true, muted: true, controls: true, loop: true, playsInline: true, fit: 'cover', aspectRatio: 0.5 }),
			el('video-plain', 'Video', { video: VIDEO + 'plain?alt=media', autoPlay: false, muted: false, controls: false, preload: 'auto' }),
			el('section-lazy', 'Core:Section', { maxWidth: 900, lazyLoad: true }, { children: [text('section-lazy-text', '<p data-section-lazy>in a lazy section</p>')] }),
			SPACER('spacer-1'),
			el('img-below', 'Image', { image: IMG + 'below', aspectRatio: 0.5 }),
			el('video-below', 'Video', { video: VIDEO + 'below?alt=media', autoPlay: true, muted: true, lazyLoad: true, aspectRatio: 0.5 }),
			SPACER('spacer-2')
		]
	}
};

export const CONTENTS: Record<string, unknown> = { forms: FORMS, media: MEDIA };
