import { type Writable } from 'svelte/store';
import type { RegisteredComponents } from '../types.js';
type $$ComponentProps = {
    builderContext: Writable<Record<string, any>>;
    name: string;
    builderComponents: RegisteredComponents;
    [k: string]: unknown;
};
declare const Slot: import("svelte").Component<$$ComponentProps, {}, "">;
type Slot = ReturnType<typeof Slot>;
export default Slot;
