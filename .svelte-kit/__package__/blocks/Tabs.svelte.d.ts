import type { Writable } from 'svelte/store';
import type { BuilderBlock, RegisteredComponents } from '../types.js';
type Tab = {
    label?: BuilderBlock[];
    content?: BuilderBlock[];
};
type $$ComponentProps = {
    defaultActiveTab?: number;
    tabs?: Tab[];
    activeTabStyle?: Record<string, unknown>;
    collapsible?: boolean;
    tabHeaderLayout?: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
    builderBlock: BuilderBlock;
    builderContext: Writable<Record<string, any>>;
    builderComponents: RegisteredComponents;
    builderLinkComponent?: unknown;
    [k: string]: unknown;
};
declare const Tabs: import("svelte").Component<$$ComponentProps, {}, "">;
type Tabs = ReturnType<typeof Tabs>;
export default Tabs;
