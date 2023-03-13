import { evaluate } from '@chainner/navi';
import {
    Condition,
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
import { getChainnerScope } from './types/chainner-scope';
import { fromJson } from './types/json';
import { assertNever } from './util';
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
    conditional: readonly InputItem[];
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
    conditional: (inputs, { options: { condition } }, schema) => {
        if (inputs.length === 0) return 'Expected at least 1 item';

        const conditionsToValidate: Condition[] = [condition];
        let c;
        // eslint-disable-next-line no-cond-assign
        while ((c = conditionsToValidate.pop())) {
            switch (c.kind) {
                case 'not': {
                    conditionsToValidate.push(c.condition);
                    break;
                }
                case 'and':
                case 'or': {
                    conditionsToValidate.push(...c.items);
                    break;
                }
                case 'enum': {
                    const { enum: enumId, values } = c;
                    const dropdown = schema.inputs.find((i) => i.id === enumId);
                    if (!dropdown) return `There is no input with the id ${enumId}`;
                    if (dropdown.kind !== 'dropdown') return 'The first item must be a dropdown';
                    if (dropdown.hasHandle) return 'The first dropdown must not have a handle';
                    const allowed = new Set(dropdown.options.map((o) => o.value));

                    const value = typeof values === 'object' ? values : [values];
                    if (value.length === 0)
                        return 'All items must have at least one condition value';
                    const invalidValue = value.find((v) => !allowed.has(v));
                    if (invalidValue !== undefined)
                        return `Invalid condition value ${JSON.stringify(invalidValue)}`;
                    break;
                }
                case 'type': {
                    const { input: inputId, condition: type } = c;
                    const input = schema.inputs.find((i) => i.id === inputId);
                    if (input === undefined)
                        return `Invalid input: There is no input with the id ${inputId}`;

                    try {
                        const cond = evaluate(fromJson(type), getChainnerScope());
                        if (cond.type === 'never')
                            return `Invalid condition: A condition type 'never' will result in the conditional inputs never being shown`;
                    } catch (e) {
                        return String(e);
                    }
                    break;
                }
                default:
                    return assertNever(c);
            }
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
