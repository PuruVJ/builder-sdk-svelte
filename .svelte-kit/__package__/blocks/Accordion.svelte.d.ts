import type { Writable } from 'svelte/store';
import type { BuilderBlock, RegisteredComponents } from '../types.js';
type Item = {
    title?: BuilderBlock[];
    detail?: BuilderBlock[];
};
type $$ComponentProps = {
    grid?: boolean;
    oneAtATime?: boolean;
    items?: Item[];
    gridRowWidth?: string;
    useChildrenForItems?: boolean;
    builderBlock: BuilderBlock;
    builderContext: Writable<Record<string, any>>;
    builderComponents: RegisteredComponents;
    builderLinkComponent?: unknown;
    [k: string]: unknown;
};
declare const Accordion: import("svelte").Component<$$ComponentProps, {}, "">;
type Accordion = ReturnType<typeof Accordion>;
export default Accordion;
