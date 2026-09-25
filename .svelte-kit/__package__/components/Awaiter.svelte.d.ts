/** A lazily loaded registered component (`component: { load }`) — official Awaiter semantics. */
import type { Snippet } from 'svelte';
type $$ComponentProps = {
    load: (() => Promise<{
        default: unknown;
    }>) | string;
    fallback?: unknown;
    props: Record<string, unknown>;
    children?: Snippet;
};
declare const Awaiter: import("svelte").Component<$$ComponentProps, {}, "">;
type Awaiter = ReturnType<typeof Awaiter>;
export default Awaiter;
