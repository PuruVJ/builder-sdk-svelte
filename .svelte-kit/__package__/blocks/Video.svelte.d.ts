import { type Snippet } from 'svelte';
import type { BuilderBlock } from '../types.js';
type $$ComponentProps = {
    lazyLoad?: boolean;
    autoPlay?: boolean;
    muted?: boolean;
    controls?: boolean;
    loop?: boolean;
    playsInline?: boolean;
    preload?: 'auto' | 'metadata' | 'none';
    attributes?: {
        style?: Record<string, unknown>;
        [k: string]: unknown;
    };
    fit?: 'contain' | 'cover' | 'fill';
    position?: string;
    aspectRatio?: number;
    posterImage?: string;
    video?: string;
    fitContent?: boolean;
    width?: number;
    height?: number;
    builderBlock?: BuilderBlock;
    children?: Snippet;
    [k: string]: unknown;
};
declare const Video: import("svelte").Component<$$ComponentProps, {}, "">;
type Video = ReturnType<typeof Video>;
export default Video;
