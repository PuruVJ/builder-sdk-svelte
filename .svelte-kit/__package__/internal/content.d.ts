/**
 * One `<Content>` render: its plan, its root state, its root scope. The same composition as the
 * official SDK (`getContentInitialValue` / `getRootStateInitialValue`), built once per render.
 */
import type { BuilderContent, RegisteredComponent } from '../types.js';
import { type Plan } from './compile.js';
import { Scope, type ContentCtx } from './scope.js';
export interface ContentInput {
    content: BuilderContent | null | undefined;
    model: string;
    data?: Record<string, unknown>;
    context?: Record<string, unknown>;
    apiKey?: string;
    apiHost?: string;
    apiVersion?: string;
    customComponents?: RegisteredComponent[];
    canTrack?: boolean;
    locale?: string;
    linkComponent?: unknown;
    blocksWrapper?: unknown;
    blocksWrapperProps?: Record<string, unknown>;
    nonce?: string;
}
/** official `getContentInitialValue`: the content with `data` merged into `content.data`. */
export declare function merged_content(content: BuilderContent | null | undefined, data: Record<string, unknown> | undefined): BuilderContent | undefined;
/** official `getRootStateInitialValue` */
export declare function initial_root_state(content: BuilderContent | null | undefined, data: Record<string, unknown> | undefined, locale: string | undefined): Record<string, unknown>;
/**
 * The plan a content renders from. Keyed by the content OBJECT the app passed: the same object
 * rendered again (an app that caches its fetch) reuses every compiled block; a fresh object compiles
 * once. (When `data` carries its own `blocks`, those are what render: key by that array instead.)
 */
export declare function plan_of(input: ContentInput): Plan;
export declare function create_content(input: ContentInput, version: () => number, bump: () => void): {
    ctx: ContentCtx;
    scope: Scope;
};
