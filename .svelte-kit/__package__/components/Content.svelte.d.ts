/**
     * `<Content>` — the official public component (ContentVariants): A/B variants, then the content.
     *
     * During SSR with A/B variations every variant renders hidden next to the default (the official
     * Svelte strategy: a cookie script picks the winner before paint); after mount only the winner stays.
     * Inside Builder's visual editor (or a preview link) the page hands off to the official SDK's
     * `<Content>` in the browser; real visitors never load it.
     */
import { type Component } from 'svelte';
import type { BuilderContent, RegisteredComponent } from '../types.js';
type $$ComponentProps = {
    content?: BuilderContent | null;
    model?: string;
    data?: Record<string, unknown>;
    context?: Record<string, unknown>;
    apiKey?: string;
    apiHost?: string;
    apiVersion?: string;
    customComponents?: RegisteredComponent[];
    canTrack?: boolean;
    locale?: string;
    enrich?: boolean;
    linkComponent?: unknown;
    blocksWrapper?: unknown;
    blocksWrapperProps?: Record<string, unknown>;
    contentWrapper?: string;
    contentWrapperProps?: Record<string, unknown>;
    trustedHosts?: string[];
    nonce?: string;
    isNestedRender?: boolean;
};
declare const Content: Component<$$ComponentProps, {}, "">;
type Content = ReturnType<typeof Content>;
export default Content;
