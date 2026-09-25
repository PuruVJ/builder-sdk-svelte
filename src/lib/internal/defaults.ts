/**
 * The built-in blocks with the official flags (name, noWrap, which builder props each receives).
 *
 * Built LAZILY, on the first registry build: importing the package runs nothing (the package is
 * `sideEffects`-free), and the block components — some of which import back into the renderer
 * (Symbol → Content) — are only read after every module has finished evaluating.
 */
import type { RegisteredComponent } from '../types.js';
import type { Compiled } from './compile.js';
import { PLAIN_RENDER } from './plain.js';
import Button from '../blocks/Button.svelte';
import Columns from '../blocks/Columns.svelte';
import CustomCode from '../blocks/CustomCode.svelte';
import Embed from '../blocks/Embed.svelte';
import Fragment from '../blocks/Fragment.svelte';
import Image from '../blocks/Image.svelte';
import Img from '../blocks/Img.svelte';
import RawText from '../blocks/RawText.svelte';
import Section from '../blocks/Section.svelte';
import Slot from '../blocks/Slot.svelte';
import Symbol from '../blocks/Symbol.svelte';
import Text from '../blocks/Text.svelte';
import PersonalizationContainer from '../blocks/PersonalizationContainer.svelte';
import Accordion from '../blocks/Accordion.svelte';
import Tabs from '../blocks/Tabs.svelte';
import Video from '../blocks/Video.svelte';
import Form from '../blocks/Form.svelte';
import FormInput from '../blocks/FormInput.svelte';
import FormSelect from '../blocks/FormSelect.svelte';
import FormSubmitButton from '../blocks/FormSubmitButton.svelte';
import FormTextarea from '../blocks/FormTextarea.svelte';

/** Text's whole output is its `text` option (Text.svelte), so a Text block can sit in a plain subtree. */
function text_html(c: Compiled): string {
	return `<div style="outline:none;" class="builder-text">${(c.options.text as { toString(): string } | undefined)?.toString() || ''}</div>`;
}

let list: RegisteredComponent[] | null = null;

export function default_components(): RegisteredComponent[] {
	if (list) return list;
	const ALL = { builderBlock: true, builderContext: true, builderComponents: true, builderLinkComponent: true };
	return (list = [
		{ component: Button, name: 'Core:Button', noWrap: true, static: true, shouldReceiveBuilderProps: { builderLinkComponent: true } },
		{ component: Columns, name: 'Columns', isRSC: true, shouldReceiveBuilderProps: ALL },
		{ component: Fragment, name: 'Fragment', static: true, canHaveChildren: true, noWrap: true },
		{ component: Image, name: 'Image', static: true, canHaveChildren: true, shouldReceiveBuilderProps: { builderBlock: true } },
		{ component: Section, name: 'Core:Section', static: true, canHaveChildren: true },
		{ component: Slot, name: 'Slot', isRSC: true, shouldReceiveBuilderProps: { builderContext: true, builderComponents: true } },
		{ component: Symbol, name: 'Symbol', noWrap: true, static: true, isRSC: true, shouldReceiveBuilderProps: ALL },
		{ component: Text, name: 'Text', static: true, shouldReceiveBuilderProps: {}, [PLAIN_RENDER]: text_html },
		{ component: CustomCode, name: 'Custom Code', static: true },
		{ component: Embed, name: 'Embed', static: true },
		{ component: Img, name: 'Raw:Img', noWrap: true },
		{ component: RawText, name: 'Builder:RawText' },
		{ component: Tabs, name: 'Builder: Tabs', shouldReceiveBuilderProps: ALL },
		{ component: Accordion, name: 'Builder:Accordion', canHaveChildren: true, shouldReceiveBuilderProps: ALL },
		{ component: Form, name: 'Form:Form', noWrap: true, canHaveChildren: true, shouldReceiveBuilderProps: ALL },
		{ component: FormInput, name: 'Form:Input', noWrap: true, static: true },
		{ component: FormSubmitButton, name: 'Form:SubmitButton', noWrap: true, static: true },
		{ component: FormSelect, name: 'Form:Select', noWrap: true, static: true },
		{ component: FormTextarea, name: 'Form:TextArea', noWrap: true, static: true },
		{ component: Video, name: 'Video', canHaveChildren: true, shouldReceiveBuilderProps: { builderBlock: true } },
		{
			component: PersonalizationContainer,
			name: 'PersonalizationContainer',
			noWrap: true,
			canHaveChildren: true,
			shouldReceiveBuilderProps: { builderBlock: true, builderContext: true, builderComponents: true }
		}
	] as RegisteredComponent[]);
}
