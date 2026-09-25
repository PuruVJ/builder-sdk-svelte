/** Image srcset (official blocks/image/image.helpers.ts) — regexes hoisted, results memoised per URL. */
export declare function get_srcset(url: string): string;
export declare const is_builder_or_shopify: (url: string) => boolean;
export declare const is_builder: (url: string) => boolean;
export declare const to_webp: (srcset: string) => string;
