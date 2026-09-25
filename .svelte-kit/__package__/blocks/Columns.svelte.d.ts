import type { Writable } from 'svelte/store';
import type { BuilderBlock, RegisteredComponents } from '../types.js';
type Column = {
    blocks?: BuilderBlock[];
    width?: number;
    link?: string;
};
type $$ComponentProps = {
    space?: number;
    columns?: Column[];
    stackColumnsAt?: 'tablet' | 'mobile' | 'never';
    builderLinkComponent?: unknown;
    reverseColumnsWhenStacked?: boolean;
    builderContext: Writable<Record<string, any>>;
    builderBlock: BuilderBlock;
    builderComponents: RegisteredComponents;
    [k: string]: unknown;
};
declare const Columns: import("svelte").Component<$$ComponentProps, {}, "">;
type Columns = ReturnType<typeof Columns>;
export default Columns;
