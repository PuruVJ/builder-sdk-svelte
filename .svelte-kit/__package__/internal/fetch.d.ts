/**
 * Content API fetching — the official `fetchOneEntry` / `fetchEntries` URL and options
 * (functions/get-content), minus the SDK-wide globals.
 */
import type { BuilderContent } from '../types.js';
export interface GetContentOptions {
    model: string;
    apiKey: string;
    limit?: number;
    offset?: number;
    userAttributes?: (Record<string, unknown> & {
        urlPath?: string;
    }) | null;
    query?: Record<string, unknown>;
    options?: Record<string, unknown> | URLSearchParams;
    canTrack?: boolean;
    enrich?: boolean;
    locale?: string;
    apiVersion?: 'v3' | string;
    fields?: string;
    omit?: string;
    cacheSeconds?: number;
    staleCacheSeconds?: number;
    sort?: Record<string, 1 | -1>;
    includeUnpublished?: boolean;
    apiHost?: string;
    fetch?: typeof fetch;
    fetchOptions?: RequestInit;
}
/** official `getBuilderSearchParams`: the `builder.*` params, prefix stripped. */
export declare function builder_search_params(input: Record<string, unknown> | URLSearchParams | undefined): Record<string, unknown>;
export declare function content_url(options: GetContentOptions): URL;
export declare function fetch_entries(options: GetContentOptions): Promise<BuilderContent[]>;
export declare function fetch_one_entry(options: GetContentOptions): Promise<BuilderContent | null>;
