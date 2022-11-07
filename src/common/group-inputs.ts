import { DropDownInput, FileInput, Group, GroupKind, Input } from './common-types';

// This helper type ensure that all group types are covered
type InputGuarantees<T extends Record<GroupKind, readonly Input[]>> = T;

type DeclaredGroupInputs = InputGuarantees<{
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
