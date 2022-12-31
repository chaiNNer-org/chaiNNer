import {
    DropDownInput,
    FileInput,
    Group,
    GroupKind,
    Input,
    InputKind,
    NodeSchema,
    NumberInput,
    OfKind,
} from './common-types';
import { VALID, Validity, invalid } from './Validity';

export interface GroupInputItem {
    readonly kind: 'group';
    readonly group: Group;
    readonly inputs: readonly InputItem[];
}
export type InputItem = Input | GroupInputItem;

// This helper type ensure that all group types are covered
type InputGuarantees<T extends Record<GroupKind, readonly InputItem[]>> = T;

type DeclaredGroupInputs = InputGuarantees<{
    'conditional-enum': readonly InputItem[];
    'from-to-dropdowns': readonly [DropDownInput, DropDownInput];
    'ncnn-file-inputs': readonly [FileInput, FileInput];
    'optional-list': readonly [InputItem, ...InputItem[]];
    seed: readonly [NumberInput];
}>;

// A bit hacky, but this ensures that GroupInputs covers exactly all group types, no more and no less
type Exact<T extends DeclaredGroupInputs> = T;

export type GroupInputs = Exact<Pick<DeclaredGroupInputs, GroupKind>>;

const allInputsOfKind = <K extends InputKind>(
    inputs: readonly InputItem[],
    kind: K
): inputs is readonly OfKind<Input, K>[] => {
    return inputs.every((i) => i.kind === kind);
};
const allAreOptional = (inputs: readonly InputItem[]): boolean => {
    return inputs.every((i) => (i.kind === 'group' ? allAreOptional(i.inputs) : i.optional));
};

const groupInputsChecks: {
    [Kind in GroupKind]: (
        inputs: readonly InputItem[],
        group: OfKind<Group, Kind>,
        schema: NodeSchema
    ) => string | undefined;
} = {
    'conditional-enum': (inputs, { options: { enum: enumId, conditions } }, schema) => {
        if (inputs.length === 0) return 'Expected at least 1 item';

        const dropdown = schema.inputs.find((i) => i.id === enumId);
        if (!dropdown) return `There is no input with the id ${enumId}`;
        if (dropdown.kind !== 'dropdown') return 'The first item must be a dropdown';
        if (dropdown.hasHandle) return 'The first dropdown must not have a handle';
        const allowed = new Set(dropdown.options.map((o) => o.value));

        if (conditions.length !== inputs.length)
            return `The number of conditions (${conditions.length}) must match the number of items (${inputs.length}).`;

        for (const cond of conditions) {
            const condition = typeof cond === 'object' ? cond : [cond];
            if (condition.length === 0) return 'All items must have at least one condition value';
            const invalidValue = condition.find((c) => !allowed.has(c));
            if (invalidValue !== undefined)
                return `Invalid condition value ${JSON.stringify(invalidValue)}`;
        }
    },
    'from-to-dropdowns': (inputs) => {
        if (inputs.length !== 2) return 'Expected exactly 2 inputs';

        if (!allInputsOfKind(inputs, 'dropdown') || !inputs.every((input) => !input.hasHandle)) {
            return `Expected all inputs to dropdowns`;
        }
    },
    'ncnn-file-inputs': (inputs) => {
        if (inputs.length !== 2) return 'Expected exactly 2 inputs';

        if (!allInputsOfKind(inputs, 'file')) return `Expected all inputs to file inputs`;
    },
    'optional-list': (inputs) => {
        if (inputs.length === 0) return 'Expected at least 1 item';

        if (!allAreOptional(inputs)) return 'Expected all inputs to be optional';
    },
    seed: (inputs) => {
        if (inputs.length !== 1) return 'Expected exactly 1 number input';
        const [input] = inputs;

        if (input.kind !== 'number') return 'Expected the input to be a number input';
    },
};

export const checkGroupInputs = (
    inputs: readonly InputItem[],
    group: Group,
    schema: NodeSchema
): Validity => {
    const checkFn = groupInputsChecks[group.kind];
    if (typeof checkFn !== 'function') {
        return invalid(`"${group.kind}" is not a valid group kind.`);
    }
    const reason = checkFn(inputs, group as never, schema);
    if (reason) return invalid(reason);
    return VALID;
};

export const getUniqueKey = (item: InputItem): number => {
    if (item.kind === 'group') return item.group.id + 2000;
    return item.id;
};
