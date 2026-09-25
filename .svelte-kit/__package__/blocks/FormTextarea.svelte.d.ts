type $$ComponentProps = {
    attributes?: Record<string, unknown>;
    placeholder?: string;
    name?: string;
    value?: string;
    defaultValue?: string;
    required?: boolean;
    [k: string]: unknown;
};
declare const FormTextarea: import("svelte").Component<$$ComponentProps, {}, "">;
type FormTextarea = ReturnType<typeof FormTextarea>;
export default FormTextarea;
