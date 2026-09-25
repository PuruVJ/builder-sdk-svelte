export declare const SDK_VERSION = "5.2.0";
export declare const sdk_headers: () => {
    'X-Builder-SDK': string;
    'X-Builder-SDK-GEN': string;
    'X-Builder-SDK-Version': string;
};
export declare function get_cookie(name: string, can_track: boolean): string | undefined;
export declare function set_cookie(name: string, value: string, can_track: boolean, expires?: Date): void;
/** The tracking user attributes (official functions/track/helpers `getUserAttributes`). */
export declare function get_user_attributes(): Record<string, unknown>;
export interface TrackEvent {
    type: string;
    apiKey: string;
    canTrack?: boolean;
    contentId?: string;
    variationId?: string;
    metadata?: Record<string, unknown>;
    apiHost?: string;
    [k: string]: unknown;
}
export declare function track({ apiHost, type, canTrack, apiKey, metadata, ...properties }: TrackEvent): Promise<void>;
export declare function interaction_properties(event: MouseEvent): {
    targetBuilderElement: string | undefined;
    metadata: {
        targetOffset: {
            x: number;
            y: number;
        } | undefined;
        builderTargetOffset: {
            x: number;
            y: number;
        } | undefined;
        builderElementIndex: number | undefined;
    };
};
