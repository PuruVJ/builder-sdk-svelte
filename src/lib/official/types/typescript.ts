// Vendored from @builder.io/sdk-svelte@5.2.0 src/types/typescript.ts (MIT) by scripts/vendor-official-types.mjs — do not edit.
export type Nullable<T> = T | null | undefined;
export type Dictionary<T> = {
  [key: string]: T;
};
export type Overwrite<T, U> = keyof U extends keyof T ? Pick<T, Exclude<keyof T, keyof U>> & U : never;
export type Prettify<T> = {

  // eslint-disable-next-line @typescript-eslint/ban-types
[K in keyof T]: T[K] } & {}