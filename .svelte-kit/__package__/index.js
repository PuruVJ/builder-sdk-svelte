import { set_default_components } from './internal/registry.js';
import Button from './blocks/Button.svelte';
import Columns from './blocks/Columns.svelte';
import CustomCode from './blocks/CustomCode.svelte';
import Embed from './blocks/Embed.svelte';
import Fragment from './blocks/Fragment.svelte';
import Image from './blocks/Image.svelte';
import Img from './blocks/Img.svelte';
import RawText from './blocks/RawText.svelte';
import Section from './blocks/Section.svelte';
import Slot from './blocks/Slot.svelte';
import Symbol from './blocks/Symbol.svelte';
import Text from './blocks/Text.svelte';
import PersonalizationContainer from './blocks/PersonalizationContainer.svelte';
import Accordion from './blocks/Accordion.svelte';
import Tabs from './blocks/Tabs.svelte';
import Video from './blocks/Video.svelte';
import Form from './blocks/Form.svelte';
import FormInput from './blocks/FormInput.svelte';
import FormSelect from './blocks/FormSelect.svelte';
import FormSubmitButton from './blocks/FormSubmitButton.svelte';
import FormTextarea from './blocks/FormTextarea.svelte';
import { fetch_entries, fetch_one_entry, builder_search_params } from './internal/fetch.js';
import { is_editing, is_previewing } from './internal/env.js';
import { track as track_event } from './internal/track.js';
import { set_user_attributes } from './internal/user-attributes.js';
import { PLAIN_COMPONENTS } from './internal/plain.js';
const ALL = { builderBlock: true, builderContext: true, builderComponents: true, builderLinkComponent: true };
/** The built-in blocks with the official flags (name, noWrap, which builder props each receives). */
export const DEFAULT_COMPONENTS = [
    { component: Button, name: 'Core:Button', noWrap: true, static: true, shouldReceiveBuilderProps: { builderLinkComponent: true } },
    { component: Columns, name: 'Columns', isRSC: true, shouldReceiveBuilderProps: ALL },
    { component: Fragment, name: 'Fragment', static: true, canHaveChildren: true, noWrap: true },
    { component: Image, name: 'Image', static: true, canHaveChildren: true, shouldReceiveBuilderProps: { builderBlock: true } },
    { component: Section, name: 'Core:Section', static: true, canHaveChildren: true },
    { component: Slot, name: 'Slot', isRSC: true, shouldReceiveBuilderProps: { builderContext: true, builderComponents: true } },
    { component: Symbol, name: 'Symbol', noWrap: true, static: true, isRSC: true, shouldReceiveBuilderProps: ALL },
    { component: Text, name: 'Text', static: true, shouldReceiveBuilderProps: {} },
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
];
set_default_components(DEFAULT_COMPONENTS);
// Text's whole output is its `text` option (Text.svelte): a Text block can sit in a plain subtree.
PLAIN_COMPONENTS.set(Text, (c) => `<div style="outline:none;" class="builder-text">${c.options.text?.toString() || ''}</div>`);
export { default as Content } from './components/Content.svelte';
export { default as Blocks } from './components/Blocks.svelte';
export { Button, Columns, Fragment, Image, Section, Symbol, Text };
export const isEditing = is_editing;
export const isPreviewing = is_previewing;
export const setClientUserAttributes = set_user_attributes;
export const getBuilderSearchParams = builder_search_params;
export const track = (args) => track_event({ ...args, canTrack: true });
export async function fetchEntries(options) {
    return fetch_entries(options);
}
export async function fetchOneEntry(options) {
    return fetch_one_entry(options);
}
/** official `_processContentResult` (the server leg: results as-is; A/B assignment is browser-side). */
export async function _processContentResult(_options, content) {
    return content.results;
}
/** Editor-facing registration — the official SDK's; the editor itself runs the official SDK here. */
export function register(_type, _info) { }
export function registerAction(_action) { }
export function setEditorSettings(_settings) { }
export function subscribeToEditor() {
    return () => { };
}
