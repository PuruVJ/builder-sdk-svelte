import { type Writable } from 'svelte/store';
import type { BuilderBlock, RegisteredComponents } from '../types.js';
import { type Variant } from './personalization.js';
type $$ComponentProps = {
    builderContext: Writable<Record<string, any>>;
    variants?: Variant[];
    builderBlock: BuilderBlock;
    attributes?: Record<string, any>;
    previewingIndex?: number | null;
    builderComponents: RegisteredComponents;
    [k: string]: unknown;
};
declare const PersonalizationContainer: import("svelte").Component<$$ComponentProps, {}, "">;
type PersonalizationContainer = ReturnType<typeof PersonalizationContainer>;
export default PersonalizationContainer;
