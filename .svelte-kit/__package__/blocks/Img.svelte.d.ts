type $$ComponentProps = {
    imgSrc?: string;
    image?: string;
    attributes?: Record<string, any>;
    altText?: string;
    title?: string;
    backgroundSize?: string;
    backgroundPosition?: string;
    aspectRatio?: number;
    [k: string]: unknown;
};
declare const Img: import("svelte").Component<$$ComponentProps, {}, "">;
type Img = ReturnType<typeof Img>;
export default Img;
