/**
 * Localized values (`{ '@type': '@builder.io/core:LocalizedValue', 'en-US': …, Default: … }`).
 *
 * The official SDK walks a block's whole `component.options` (nested child blocks included) on
 * EVERY `getProcessedBlock` call — ~107 times per block per render, the single largest SSR cost it
 * has. Here each block's options are resolved once, when the block is compiled, and the result is
 * cached with it. The input is never mutated.
 */
/** `options` with every localized value replaced by its `locale` entry (a copy only where one was). */
export declare function resolve_localized(options: Record<string, unknown> | undefined, locale: string | undefined): Record<string, unknown> | undefined;
