type $$ComponentProps = {
    attributes?: Record<string, unknown>;
    link?: string;
    openLinkInNewTab?: boolean;
    builderLinkComponent?: unknown;
    text?: string;
    [k: string]: unknown;
};
declare const Button: import("svelte").Component<$$ComponentProps, {}, "">;
type Button = ReturnType<typeof Button>;
export default Button;
