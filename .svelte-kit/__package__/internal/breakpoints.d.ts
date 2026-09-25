/**
 * Responsive breakpoints — the official `getSizesForBreakpoints`, computed once per content (the
 * official SDK deep-clones the size table twice per block per render).
 */
export type SizeName = 'large' | 'medium' | 'small' | 'xsmall';
type Size = {
    min: number;
    default: number;
    max: number;
};
export type Sizes = Record<SizeName, Size>;
export interface Breakpoints {
    xsmall?: number;
    small?: number;
    medium?: number;
}
export declare function sizes_for(breakpoints: Breakpoints | undefined): Sizes;
export declare const max_width_query: (size: SizeName, sizes: Sizes) => string;
export {};
