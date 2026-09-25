/**
 * The component registry: name → registered component, built ONCE per custom-component list.
 *
 * The official SDK rebuilds it for every `<Content>` (and every Symbol): two `reduce`s that spread
 * the accumulator (O(C²)) and a `JSON.parse(JSON.stringify(info))` (with `fn.toString()`) per
 * component, twice. Here it is cached by the identity of the list the app passes (apps keep that
 * list in a module constant), and the editor-facing serialized infos are never built on the hot path.
 */
import type { RegisteredComponent, RegisteredComponents } from '../types.js';
import { default_components } from './defaults.js';

export const REGISTRY_BRAND = Symbol.for('puruvj.builder.registry');

export interface Registry {
	[REGISTRY_BRAND]: true;
	/** name → component, custom over default */
	by_name: Map<string, RegisteredComponent>;
	/** The object form a component with `builderComponents` receives, per model (filtered). */
	as_object(model: string): RegisteredComponents;
}

const by_list = new WeakMap<object, Registry>();
let by_list_empty: Registry | null = null;

export function registry_for(custom: RegisteredComponent[] | RegisteredComponents | Registry | undefined | null): Registry {
	if (custom && (custom as Registry)[REGISTRY_BRAND]) return custom as Registry;
	if (!custom) return (by_list_empty ??= build([]));
	let reg = by_list.get(custom);
	if (!reg) {
		// An array (the `customComponents` prop) or a name→component object (`builderComponents`,
		// handed back to <Blocks registeredComponents>): both describe the full set of components.
		const list = Array.isArray(custom) ? custom : Object.values(custom as RegisteredComponents);
		reg = Array.isArray(custom) ? build(list) : build_exact(list);
		by_list.set(custom, reg);
	}
	return reg;
}

function build(custom: RegisteredComponent[]): Registry {
	return build_exact([...default_components(), ...custom]);
}

function build_exact(list: RegisteredComponent[]): Registry {
	const by_name = new Map<string, RegisteredComponent>();
	for (const entry of list) if (entry?.name) by_name.set(entry.name, entry);
	const objects = new Map<string, RegisteredComponents>();
	return {
		[REGISTRY_BRAND]: true,
		by_name,
		as_object(model: string) {
			let obj = objects.get(model);
			if (!obj) {
				obj = {};
				for (const [name, entry] of by_name) if (!is_restricted(entry, model)) obj[name] = entry;
				// Brand it so <Blocks registeredComponents={builderComponents}> maps straight back here.
				Object.defineProperty(obj, REGISTRY_BRAND, { value: true });
				Object.defineProperty(obj, 'by_name', { value: by_name });
				Object.defineProperty(obj, 'as_object', { value: this.as_object });
				objects.set(model, obj);
			}
			return obj;
		}
	};
}

export function is_restricted(entry: RegisteredComponent | undefined, model: string | undefined): boolean {
	if (!entry) return true;
	if (!model) return false;
	return !!entry.models && entry.models.length > 0 && !entry.models.includes(model);
}

const warned = new Set<string>();

/** The component a block names, or `undefined` (warned once per name, not once per call). */
export function lookup(registry: Registry, name: string, model: string | undefined): RegisteredComponent | undefined {
	const entry = registry.by_name.get(name);
	if (!entry || is_restricted(entry, model)) {
		if (!warned.has(name)) {
			warned.add(name);
			console.warn(`
      Could not find a registered component named "${name}".
      If you registered it, is the file that registered it imported by the file that needs to render it?`);
		}
		return undefined;
	}
	return entry;
}
