/**
 * The component registry: name → registered component, built ONCE per custom-component list.
 *
 * The official SDK rebuilds it for every `<Content>` (and every Symbol): two `reduce`s that spread
 * the accumulator (O(C²)) and a `JSON.parse(JSON.stringify(info))` (with `fn.toString()`) per
 * component, twice. Here it is cached by the identity of the list the app passes (apps keep that
 * list in a module constant), and the editor-facing serialized infos are never built on the hot path.
 */
import type { RegisteredComponent, RegisteredComponents } from '../types.js';
export declare const REGISTRY_BRAND: unique symbol;
export interface Registry {
    [REGISTRY_BRAND]: true;
    /** name → component, custom over default */
    by_name: Map<string, RegisteredComponent>;
    /** The object form a component with `builderComponents` receives, per model (filtered). */
    as_object(model: string): RegisteredComponents;
}
/** Set by the package entry (defaults import the built-in block components). */
export declare function set_default_components(list: RegisteredComponent[]): void;
export declare function registry_for(custom: RegisteredComponent[] | RegisteredComponents | Registry | undefined | null): Registry;
export declare function is_restricted(entry: RegisteredComponent | undefined, model: string | undefined): boolean;
/** The component a block names, or `undefined` (warned once per name, not once per call). */
export declare function lookup(registry: Registry, name: string, model: string | undefined): RegisteredComponent | undefined;
