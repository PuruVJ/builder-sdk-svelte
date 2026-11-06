// Form:Form and its fields — Form:Input, Form:Select, Form:TextArea, Form:SubmitButton (official
// blocks/form/*): every input type, required, default values, placeholders, the submit options.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check, comp, each_case, lines, page, setup, teardown, text } from './harness.js';

beforeAll(setup);
afterAll(teardown);

const one = (name: string, options: Record<string, unknown>, rest: Record<string, unknown> = {}) => page([comp('f', name, options, rest)]);
const fields = [
	comp('i1', 'Form:Input', { name: 'email', type: 'email', placeholder: 'you@x.com', required: true }),
	comp('i2', 'Form:TextArea', { name: 'msg', placeholder: 'Say hi' }),
	comp('i3', 'Form:Select', { name: 'pick', options: [{ value: 'a', name: 'A' }, { value: 'b' }] }),
	comp('i4', 'Form:SubmitButton', { text: 'Send' })
];
const form = (options: Record<string, unknown>, rest: Record<string, unknown> = {}) => one('Form:Form', options, { children: fields, ...rest });
const messages = {
	successMessage: [text('ok', 'Thanks!')],
	errorMessage: [text('err', 'Oops')],
	sendingMessage: [text('sending', 'Sending...')]
};

describe('Form:Form', () => {
	each_case(it, {
		'with fields': { content: form({}) },
		'no children': { content: one('Form:Form', {}) },
		'action and method': { content: form({ action: 'https://example.com/submit', method: 'GET' }) },
		'sendWithJs drops the action': { content: form({ action: 'https://example.com/submit', sendWithJs: true }) },
		name: { content: form({ name: 'contact' }) },
		validate: { content: form({ validate: true }) },
		'validate false': { content: form({ validate: false }) },
		'sendSubmissionsTo email': { content: form({ sendSubmissionsTo: 'email', sendSubmissionsToEmail: 'a@b.c' }) },
		'sendSubmissionsTo zapier': { content: form({ sendSubmissionsTo: 'zapier', action: 'https://hooks.zapier.com/x' }) },
		'sendSubmissionsTo custom': { content: form({ sendSubmissionsTo: 'custom', action: '/api', contentType: 'application/json', customHeaders: { 'x-a': '1' } }) },
		'success / error / sending messages (none shown on the server)': { content: form(messages) },
		'previewState success (only in the editor)': { content: form({ previewState: 'success', ...messages }) },
		'previewState error (only in the editor)': { content: form({ previewState: 'error', ...messages }) },
		'other options': { content: form({ errorMessagePath: 'error.message', resetFormOnSubmit: false, successUrl: '/thanks' }) },
		'block attributes': { content: form({}, { properties: { class: 'f', 'data-form': 'yes' } }) },
		'styled': { content: form({}, { responsiveStyles: { large: { padding: '10px' } } }) }
	});

	it('ours: a form with an action and method keeps them; sendWithJs drops the action', () => {
		const a = check({ content: form({ action: '/submit', method: 'GET', name: 'n' }) });
		const f = lines(a.ours, /<form/)[0];
		expect(f).toContain('action="/submit"');
		expect(f).toContain('method="GET"');
		expect(f).toContain('name="n"');
		const b = check({ content: form({ action: '/submit', sendWithJs: true }) });
		// (the official `action={!sendWithJs && action}` writes the false: kept, the same markup)
		expect(lines(b.ours, /<form/)[0]).toContain('action="false"');
		const c = check({ content: form(messages) });
		expect(c.ours.tree).not.toContain('Thanks!');
	});
});

const TYPES = ['text', 'email', 'number', 'tel', 'password', 'url', 'date', 'datetime-local', 'time', 'checkbox', 'radio', 'range', 'file', 'hidden', 'color', 'search'];

describe('Form:Input', () => {
	const table: Record<string, { content: unknown }> = {};
	for (const type of TYPES) table[`type ${type}`] = { content: one('Form:Input', { type, name: `f-${type}` }) };
	each_case(it, {
		...table,
		'no type': { content: one('Form:Input', { name: 'x' }) },
		required: { content: one('Form:Input', { name: 'x', required: true }) },
		'required false': { content: one('Form:Input', { name: 'x', required: false }) },
		placeholder: { content: one('Form:Input', { name: 'x', placeholder: 'Type here' }) },
		defaultValue: { content: one('Form:Input', { name: 'x', defaultValue: 'preset' }) },
		value: { content: one('Form:Input', { name: 'x', value: 'v' }) },
		'value and defaultValue': { content: one('Form:Input', { name: 'x', value: 'v', defaultValue: 'd' }) },
		'checkbox with a value': { content: one('Form:Input', { name: 'x', type: 'checkbox', value: 'yes' }) },
		'block attributes': { content: one('Form:Input', { name: 'x' }, { properties: { class: 'inp', autocomplete: 'off' } }) },
		'styled': { content: one('Form:Input', { name: 'x' }, { responsiveStyles: { large: { border: '1px solid' } } }) }
	});

	it('ours: required and the value are on the input', () => {
		const c = check({ content: one('Form:Input', { name: 'x', type: 'email', required: true, value: 'v', placeholder: 'p' }) });
		const input = lines(c.ours, /<input/)[0];
		expect(input).toContain('required=""');
		expect(input).toContain('type="email"');
		expect(input).toContain('value="v"');
		expect(input).toContain('placeholder="p"');
	});
});

describe('Form:Select', () => {
	each_case(it, {
		options: { content: one('Form:Select', { name: 's', options: [{ value: 'a', name: 'Apple' }, { value: 'b', name: 'Banana' }] }) },
		'options without names': { content: one('Form:Select', { name: 's', options: [{ value: 'a' }, { value: 'b' }] }) },
		'no options': { content: one('Form:Select', { name: 's' }) },
		'empty options': { content: one('Form:Select', { name: 's', options: [] }) },
		required: { content: one('Form:Select', { name: 's', required: true, options: [{ value: 'a' }] }) },
		value: { content: one('Form:Select', { name: 's', value: 'b', options: [{ value: 'a' }, { value: 'b' }] }) },
		defaultValue: { content: one('Form:Select', { name: 's', defaultValue: 'b', options: [{ value: 'a' }, { value: 'b' }] }) },
		'block attributes': { content: one('Form:Select', { name: 's', options: [{ value: 'a' }] }, { properties: { class: 'sel' } }) }
	});
});

describe('Form:TextArea', () => {
	each_case(it, {
		default: { content: one('Form:TextArea', {}) },
		'name and placeholder': { content: one('Form:TextArea', { name: 't', placeholder: 'Write' }) },
		required: { content: one('Form:TextArea', { name: 't', required: true }) },
		value: { content: one('Form:TextArea', { name: 't', value: 'hello' }) },
		defaultValue: { content: one('Form:TextArea', { name: 't', defaultValue: 'preset' }) },
		'block attributes': { content: one('Form:TextArea', { name: 't' }, { properties: { class: 'ta', rows: '4' } }) }
	});
});

describe('Form:SubmitButton', () => {
	each_case(it, {
		text: { content: one('Form:SubmitButton', { text: 'Send' }) },
		'no text': { content: one('Form:SubmitButton', {}) },
		'block attributes': { content: one('Form:SubmitButton', { text: 'Go' }, { properties: { class: 'sb', disabled: 'true' } }) },
		styled: { content: one('Form:SubmitButton', { text: 'Go' }, { responsiveStyles: { large: { color: 'white' } } }) }
	});

	it('ours: a submit button', () => {
		const c = check({ content: one('Form:SubmitButton', { text: 'Send' }) });
		expect(lines(c.ours, /<button/)[0]).toContain('type="submit"');
	});
});
