import type { BuilderBlock, RegisteredComponent, RegisteredComponents } from '../types.js';
type $$ComponentProps = {
    blocks?: BuilderBlock[];
    parent?: string;
    path?: string;
    styleProp?: Record<string, unknown>;
    BlocksWrapperProps?: Record<string, unknown>;
    context?: unknown;
    className?: string;
    linkComponent?: unknown;
    registeredComponents?: RegisteredComponents | RegisteredComponent[];
    children?: import('svelte').Snippet;
};
declare const Blocks: import("svelte").Component<$$ComponentProps, {}, "">;
type Blocks = ReturnType<typeof Blocks>;
export default Blocks;
