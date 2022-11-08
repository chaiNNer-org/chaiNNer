import { DropDownInput, FileInput, Group, GroupKind, Input } from './common-types';

// This helper type ensure that all group types are covered
type InputGuarantees<T extends Record<GroupKind, readonly Input[]>> = T;

type DeclaredGroupInputs = InputGuarantees<{
    'conditional-enum': readonly [DropDownInput, ...Input[]];
    'from-to-dropdowns': readonly [DropDownInput, DropDownInput];
    'ncnn-file-inputs': readonly [FileInput, FileInput];
    'optional-list': readonly [Input, ...Input[]];
}>;

// A bit hacky, but this ensures that GroupInputs covers exactly all group types, no more and no less
type Exact<T extends DeclaredGroupInputs> = T;

export type GroupInputs = Exact<Pick<DeclaredGroupInputs, GroupKind>>;

export const groupInputsChecks: {
    [Type in GroupKind]: (
        inputs: readonly Input[],
        group: Group & { readonly type: Type }
    ) => boolean;
} = {
    'conditional-enum': (inputs, { options: { conditions } }) => {
        if (inputs.length === 0) return false;

        const dropdown = inputs[0];
        if (dropdown.kind !== 'dropdown') return false;
        if (dropdown.hasHandle) return false;
        const allowed = new Set(dropdown.options.map((o) => o.value));
        const idStrings = new Set(inputs.slice(1).map((i) => String(i.id)));

        return Object.entries(conditions).every(([id, cond]) => {
            if (!cond) return true;
            return idStrings.has(id) && cond.length > 0 && cond.every((c) => allowed.has(c));
        });
    },
    'from-to-dropdowns': (inputs) => {
        return (
            inputs.length === 2 &&
            inputs.every((i) => {
                return i.kind === 'dropdown' && !i.hasHandle;
            })
        );
    },
    'ncnn-file-inputs': (inputs) => {
        return inputs.length === 2 && inputs.every((i) => i.kind === 'file');
    },
    'optional-list': (inputs) => {
        return inputs.length >= 1 && inputs.every((i) => i.optional);
    },
};
