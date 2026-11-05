// Vendored from @builder.io/sdk-svelte@5.2.0 src/components/content/content.types.ts (MIT) by scripts/vendor-official-types.mjs — do not edit.
import type { BuilderRenderState } from '../../context/types.js';
export type { ContentProps } from './contentProps.types.js';
export interface BuilderComponentStateChange {
  state: BuilderRenderState;
  ref: {
    name?: string;
    props?: {
      builderBlock?: {
        id?: string;
      };
    };
  };
}