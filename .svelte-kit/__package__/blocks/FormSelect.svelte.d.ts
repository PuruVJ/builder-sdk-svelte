type $$ComponentProps = {
    attributes?: Record<string, unknown>;
    value?: string;
    defaultValue?: string;
    name?: string;
    required?: boolean;
    options?: {
        name?: string;
        value: string;
    }[];
    [k: string]: unknown;
};
declare const FormSelect: import("svelte").Component<$$ComponentProps, {}, "">;
type FormSelect = ReturnType<typeof FormSelect>;
export default FormSelect;
