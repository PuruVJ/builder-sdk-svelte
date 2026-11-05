// Vendored from @builder.io/sdk-svelte@5.2.0 src/blocks/video/video.types.ts (MIT) by scripts/vendor-official-types.mjs — do not edit.
import type { BuilderBlock } from '../../types/builder-block.js';
export interface VideoProps {
  attributes?: any;
  video?: string;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  aspectRatio?: number;
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover' | 'fill';
  preload?: 'auto' | 'metadata' | 'none';
  position?: 'center' | 'top' | 'left' | 'right' | 'bottom' | 'top left' | 'top right' | 'bottom left' | 'bottom right';
  posterImage?: string;
  lazyLoad?: boolean;
  children?: any;
  fitContent?: boolean;
  builderBlock?: BuilderBlock;
}