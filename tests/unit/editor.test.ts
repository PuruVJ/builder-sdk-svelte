// internal/editor.ts on the server: registration is recorded, nothing is posted, nothing throws.
import { describe, expect, it } from 'vitest';
import { create_register_component_message, NOT_IN_EDITOR, register, register_action, set_editor_settings } from '../../src/lib/internal/editor.js';
import { register as official_register, registerAction } from '../../node_modules/@builder.io/sdk-svelte/src/functions/register';
import { setEditorSettings } from '../../node_modules/@builder.io/sdk-svelte/src/functions/set-editor-settings';

describe('editor functions on the server', () => {
	it('do not throw (and post nothing: there is no window)', () => {
		for (const [ours, theirs] of [
			[() => register('plugin', { fn: () => 1 }), () => official_register('plugin', { fn: () => 1 })],
			[() => register_action({ action: () => 'x' }), () => registerAction({ action: () => 'x' } as never)],
			[() => set_editor_settings({ customInsertMenu: true }), () => setEditorSettings({ customInsertMenu: true })]
		])
			expect(ours).not.toThrow(), expect(theirs).not.toThrow();
	});
	it('register_action(undefined): no-op on the server', () => expect(() => register_action(undefined)).not.toThrow());
	it('the message is plain data', () => {
		expect(create_register_component_message({ name: 'A', f: () => 1 })).toEqual({
			type: 'builder.registerComponent',
			data: { name: 'A', f: 'return (() => 1).apply(this, arguments)' }
		});
	});
	it('NOT_IN_EDITOR is a registered symbol', () => expect(NOT_IN_EDITOR).toBe(Symbol.for('puruvj.builder.not-in-editor')));
});
