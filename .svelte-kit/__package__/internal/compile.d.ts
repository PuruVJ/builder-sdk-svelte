/**
 * THE COMPILER — everything about a block that does not depend on state, computed once.
 *
 * The official SDK derives a block's render inputs from scratch every time its template reads one of
 * them: ~107 `getProcessedBlock` calls per block per render (each a full walk of the block's
 * options), ~65 registry lookups, 9 option merges, CSS built twice with a deep-cloned size table.
 *
 * Here a block compiles ONCE per plan into a `Compiled` record: resolved component, merged options,
 * wrapper attributes, CSS text, compiled bindings / repeat / text templates / actions. A render of a
 * static block is then a handful of property reads. A block with bindings compiles its STATIC part
 * once and, per render, applies the bindings through a copy-on-write path and re-derives only that
 * block (linear, no whole-subtree clone).
 *
 * The plan also builds ONE stylesheet for every static block it can reach from the content, so the
 * page gets one `<style>` instead of one per block.
 */
import type { BuilderBlock, RegisteredComponent } from '../types.js';
import { type Sizes } from './breakpoints.js';
import { compile_code } from './evaluate.js';
import { type Registry } from './registry.js';
type Fn = ReturnType<typeof compile_code>;
export interface Compiled {
    src: BuilderBlock;
    /** What `builderBlock` is: `src`, or a copy with localized options resolved. */
    builder_block: BuilderBlock;
    id: string | undefined;
    /** null: the block names no component; undefined: it names one that is not registered. */
    comp: RegisteredComponent | null | undefined;
    no_wrap: boolean;
    is_link: boolean;
    tag: string;
    empty_tag: boolean;
    /** `component.options` (localized) + `block.options` — the component's props. */
    options: Record<string, unknown>;
    /** A Text block's `{{expr}}` template, compiled. */
    text_tpl: Array<string | {
        fn: Fn;
        code: string;
    }> | null;
    /** href, properties, builder-id, style, class — the wrapper element's attributes. */
    attrs: Record<string, unknown>;
    actions: Array<[event: string, code: string, fn: Fn]> | null;
    bindings: Array<{
        path: string[];
        code: string;
        fn: Fn;
    }> | null;
    repeat: {
        code: string;
        fn: Fn;
        item_name: string;
        block: BuilderBlock;
    } | null;
    /** official Block `canShowBlock` (non-repeat) */
    visible: boolean;
    /** official BlockStyles `canShowBlock` + css text */
    css: string;
    children: BuilderBlock[];
    /** The subtree as plain HTML (plain.ts): undefined = not computed yet, null = has behaviour. */
    html?: string | null;
    /** The plain subtree contains a link (a link component, when set, needs a live <Block>). */
    links?: boolean;
}
export interface PlanOptions {
    registry: Registry;
    model: string;
    locale: string | undefined;
    breakpoints: {
        xsmall?: number;
        small?: number;
        medium?: number;
    } | undefined;
}
export declare class Plan {
    readonly options: PlanOptions;
    readonly registry: Registry;
    readonly model: string;
    readonly locale: string | undefined;
    readonly sizes: Sizes;
    readonly has_xsmall: boolean;
    readonly compiled: WeakMap<BuilderBlock, Compiled>;
    /** Blocks whose CSS is already in {@link sheet} (their render emits no `<style>` of its own). */
    readonly in_sheet: WeakSet<BuilderBlock>;
    sheet: string;
    /** What the content uses that needs page-level helper scripts (found by the same one walk). */
    readonly flags: {
        personalization: boolean;
        ab: boolean;
    };
    constructor(opts: PlanOptions);
    /** The block's compiled record (cached for the life of the plan). */
    compile(block: BuilderBlock): Compiled;
    /**
     * Compile every block reachable from `blocks` (children, and blocks nested anywhere in options —
     * a Columns column, a custom container's slot) and gather the CSS of the static, visible ones
     * into {@link sheet}. One walk per content.
     */
    prepare(blocks: BuilderBlock[] | undefined): void;
    /** Compile a block without caching (a bound block's per-render copy). */
    compile_fresh(block: BuilderBlock): Compiled;
}
/** official BlockStyles `css()` — the same text, once. */
export declare function block_css(block: BuilderBlock, plan: Plan): string;
export declare function plan_for(key_obj: object, opts: PlanOptions, blocks: BuilderBlock[] | undefined): Plan;
export {};
