import { Condition, Group, GroupId, InputId, NodeSchema, OfKind } from '../common-types';
import { EMPTY_ARRAY, lazyKeyed } from '../util';

/**
 * A stack of condition that are above (not including) the given input or group.
 */
export interface GroupStacks {
    readonly inputs: ReadonlyMap<InputId, readonly Group[]>;
    readonly groups: ReadonlyMap<GroupId, readonly Group[]>;

    readonly inputConditions: ReadonlyMap<InputId, readonly Condition[]>;
    readonly groupConditions: ReadonlyMap<GroupId, readonly Condition[]>;
}

export const getGroupStacks = lazyKeyed((schema: NodeSchema): GroupStacks => {
    const inputs = new Map<InputId, readonly Group[]>();
    const groups = new Map<GroupId, readonly Group[]>();
    const inputConditions = new Map<InputId, readonly Condition[]>();
    const groupConditions = new Map<GroupId, readonly Condition[]>();

    let stack: readonly Group[] = EMPTY_ARRAY;
    let conditionStack: readonly Condition[] = EMPTY_ARRAY;
    const recurse = (items: readonly (InputId | Group)[]): void => {
        for (const i of items) {
            if (typeof i === 'number') {
                inputs.set(i, stack);
                inputConditions.set(i, conditionStack);
            } else {
                groups.set(i.id, stack);
                groupConditions.set(i.id, conditionStack);

                const prevStack = stack;
                const prevConditionStack = conditionStack;

                stack = [...stack, i];
                if (i.kind === 'conditional') {
                    conditionStack = [...conditionStack, i.options.condition];
                }

                recurse(i.items);

                stack = prevStack;
                conditionStack = prevConditionStack;
            }
        }
    };

    recurse(schema.groupLayout);

    return { inputs, groups, inputConditions, groupConditions };
});

export const getRequireCondition = (
    schema: NodeSchema,
    group: OfKind<Group, 'required'>
): Condition => {
    const { groupConditions } = getGroupStacks(schema);
    const conditions = groupConditions.get(group.id) ?? EMPTY_ARRAY;
    return { kind: 'and', items: [...conditions, group.options.condition] };
};

export const getRequireConditions = (schema: NodeSchema): ReadonlyMap<InputId, Condition> => {
    const result = new Map<InputId, Condition>();

    const { inputs } = getGroupStacks(schema);
    for (const [inputId, groups] of inputs) {
        const conditions: Condition[] = [];
        let require = false;
        for (const group of groups) {
            if (group.kind === 'conditional') {
                conditions.push(group.options.condition);
            } else if (group.kind === 'required') {
                conditions.push(group.options.condition);
                require = true;
            }
        }

        if (require) {
            result.set(inputId, { kind: 'and', items: conditions });
        }
    }

    return result;
};
