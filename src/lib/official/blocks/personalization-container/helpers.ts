// Vendored from @builder.io/sdk-svelte@5.2.0 src/blocks/personalization-container/helpers.ts (MIT) by scripts/vendor-official-types.mjs — do not edit.
/** official blocks/personalization-container/helpers.ts — its types only */
export type UserAttributes = {
  date?: string | Date;
  urlPath?: string;
  [key: string]: any;
};
type QueryOperator = 'is' | 'isNot' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqualTo' | 'lessThanOrEqualTo';
type QueryValue = string | number | boolean | Array<string | number | boolean>;
export type Query = {
  property: string;
  operator: QueryOperator;
  value: QueryValue;
};
