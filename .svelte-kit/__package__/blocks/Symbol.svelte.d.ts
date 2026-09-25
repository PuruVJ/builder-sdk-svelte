import { type Writable } from 'svelte/store';
import type { BuilderBlock, BuilderContent, RegisteredComponents } from '../types.js';
type SymbolInfo = {
    model?: string;
    entry?: string;
    data?: Record<string, unknown>;
    content?: BuilderContent;
    inline?: boolean;
    dynamic?: boolean;
    ownerId?: string;
    global?: boolean;
};
type $$ComponentProps = {
    symbol?: SymbolInfo;
    builderComponents: RegisteredComponents;
    attributes?: Record<string, unknown>;
    dynamic?: boolean;
    builderContext: Writable<Record<string, any>>;
    builderBlock: BuilderBlock;
    builderLinkComponent?: unknown;
    [k: string]: unknown;
};
declare const Symbol: import("svelte").Component<$$ComponentProps, {}, "">;
type Symbol = ReturnType<typeof Symbol>;
export default Symbol;
