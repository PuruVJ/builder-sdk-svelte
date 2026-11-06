// Vendored from @builder.io/sdk-svelte@5.2.0 src/components/blocks/blocks-wrapper.types.ts (MIT) by scripts/vendor-official-types.mjs — do not edit.
import type { BuilderBlock } from '../../types/builder-block.js';
/** official components/blocks/blocks-wrapper.svelte (its `context="module"` type) */
export type BlocksWrapperProps = {
  blocks: BuilderBlock[] | undefined;
  parent: string | undefined;
  path: string | undefined;
  styleProp: Record<string, any> | undefined;
  /**
   * The element that wraps each list of blocks. Defaults to a `div` element ('ScrollView' in React Native).
   */
  BlocksWrapper: any;
  /**
   * Props to be applied to the wrapping element of blocks.
   */
  BlocksWrapperProps: any;
  children?: any;
  classNameProp?: string;
};
