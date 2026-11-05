// Vendored from @builder.io/sdk-svelte@5.2.0 src/types/builder-props.ts (MIT) by scripts/vendor-official-types.mjs — do not edit.
import type { Writable } from "svelte/store";
import type { BuilderContextInterface, RegisteredComponents } from '../context/types.js';
import type { BuilderBlock } from './builder-block.js';
export type BuilderDataProps = {
  builderBlock: BuilderBlock;
  builderContext: Writable<BuilderContextInterface>;
};
export type BuilderComponentsProp = {
  builderComponents: RegisteredComponents;
};
export type BuilderLinkComponentProp = {
  builderLinkComponent?: any;
};
export type BuilderNonceProp = {
  nonce: string;
}