import { Condition, Group, InputId, NodeSchema, OfKind } from '../common-types';

const getRequiredConditionStack = (
    inputs: readonly (InputId | Group)[],
    target: OfKind<Group, 'required'>
): Condition[] | undefined => {
    for (const i of inputs) {
        if (typeof i === 'object') {
            if (i === target) {
                return [target.options.condition];
            }
            if (i.kind === 'conditional') {
                const inner = getRequiredConditionStack(i.items, target);
                if (inner) {
                    inner.push(i.options.condition);
                    return inner;
                }
            }
        }
    }
    return undefined;
};

export const getFullRequireCondition = (
    schema: NodeSchema,
    group: OfKind<Group, 'required'>
): Condition => {
    const result = getRequiredConditionStack(schema.groupLayout, group);
    if (!result) {
        throw new Error('The given group was not part of the given schema');
    }
    return { kind: 'and', items: result };
};
