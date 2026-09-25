export type Animation = {
    trigger?: string;
    id?: string;
    elementId?: string;
    duration: number;
    delay?: number;
    easing: string;
    repeat?: boolean;
    thresholdPercent?: number;
    steps: Array<{
        styles: Record<string, string>;
    }>;
};
export declare function trigger_animation(a: Animation): void;
export declare function bind_animations(animations: Animation[]): void;
