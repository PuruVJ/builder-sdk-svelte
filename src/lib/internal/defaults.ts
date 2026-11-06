/**
 * The built-in blocks, in the official order (`getDefaultRegisteredComponents()`,
 * constants/builder-registered-components.ts + extra-components.ts, TARGET 'svelte'), each with the
 * official info (component-info.ts): what the editor is sent in `builder.registerComponent`.
 *
 * Built LAZILY, on the first registry build: importing the package runs nothing (the package is
 * `sideEffects`-free), and the block components — some of which import back into the renderer
 * (Symbol → Content) — are only read after every module has finished evaluating.
 */
import type { RegisteredComponent } from '../types.js';
import type { Compiled } from './compile.js';
import { PLAIN_RENDER } from './plain.js';
import * as info from './component-info.js';
import { NOT_IN_EDITOR } from './editor.js';
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
	return (list = [
		{ component: Button, ...info.button_info() },
		{ component: Columns, ...info.columns_info() },
		{ component: Fragment, ...info.fragment_info() },
		{ component: Image, ...info.image_info() },
		{ component: Section, ...info.section_info() },
		{ component: Slot, ...info.slot_info() },
		{ component: Symbol, ...info.symbol_info() },
		{ component: Text, ...info.text_info(), [PLAIN_RENDER]: text_html },
		{ component: PersonalizationContainer, ...info.personalization_container_info() },
		{ component: Tabs, ...info.tabs_info() },
		{ component: Accordion, ...info.accordion_info() },
		{ component: CustomCode, ...info.custom_code_info() },
		{ component: Embed, ...info.embed_info() },
		{ component: Form, ...info.form_info() },
		{ component: FormInput, ...info.form_input_info() },
		{ component: FormSubmitButton, ...info.form_submit_button_info() },
		{ component: FormSelect, ...info.form_select_info() },
		{ component: FormTextarea, ...info.form_textarea_info() },
		{ component: Img, ...info.img_info() },
		{ component: Video, ...info.video_info() },
		// NOT in the official list, so never sent to the editor; ours renders it anyway.
		{ component: RawText, ...info.raw_text_info(), [NOT_IN_EDITOR]: true }
	] as RegisteredComponent[]);
}
