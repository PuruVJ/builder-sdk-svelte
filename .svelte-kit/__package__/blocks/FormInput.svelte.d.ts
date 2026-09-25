type $$ComponentProps = {
    attributes?: Record<string, unknown>;
    defaultValue?: string;
    placeholder?: string;
    type?: string;
    name?: string;
    value?: string;
    required?: boolean;
    [k: string]: unknown;
};
declare const FormInput: import("svelte").Component<$$ComponentProps, {}, "">;
type FormInput = ReturnType<typeof FormInput>;
export default FormInput;
