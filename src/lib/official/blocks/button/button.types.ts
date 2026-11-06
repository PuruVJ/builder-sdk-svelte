// Vendored from @builder.io/sdk-svelte@5.2.0 src/blocks/button/button.types.ts (MIT) by scripts/vendor-official-types.mjs — do not edit.
import type { BuilderLinkComponentProp } from '../../types/builder-props.js';
export interface ButtonProps extends BuilderLinkComponentProp {
  attributes?: any;
  text?: string;
  link?: string;
  openLinkInNewTab?: boolean;
}