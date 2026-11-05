// Vendored from @builder.io/sdk-svelte@5.2.0 src/components/blocks/blocks.types.ts (MIT) by scripts/vendor-official-types.mjs — do not edit.
import type { Writable } from "svelte/store";
import type { BuilderContextInterface, RegisteredComponents } from '../../context/types.js';
import type { BlocksWrapperProps } from './blocks-wrapper.types.js';
export type BlocksProps = Partial<Omit<BlocksWrapperProps, 'BlocksWrapper' | 'classNameProp'>> & {
  context?: Writable<BuilderContextInterface>;
  registeredComponents?: RegisteredComponents;
  linkComponent?: any;
  className?: string;
}