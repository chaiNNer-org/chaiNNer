import { Condition, Group, GroupId, InputId, NodeSchema, OfKind } from '../common-types';
import { lazyKeyed } from '../util';

const analyseInputs = lazyKeyed(
    (
        schema: NodeSchema
    ): readonly [ReadonlyMap<InputId, Condition>, ReadonlyMap<GroupId, Condition>] => {
        const byInput = new Map<InputId, Condition>();
        const byGroup = new Map<GroupId, Condition>();

        const conditionStack: Condition[] = [];
        const recurse = (inputs: readonly (InputId | Group)[]): void => {
            for (const i of inputs) {
                if (typeof i === 'object') {
                    if (i.kind === 'required') {
                        const condition: Condition = {
                            kind: 'and',
                            items: [...conditionStack, i.options.condition],
                        };

                        byGroup.set(i.id, condition);
                        for (const j of i.items) {
                            if (typeof j === 'number') {
                                byInput.set(j, condition);
                            }
                        }
                    } else if (i.kind === 'conditional') {
                        conditionStack.push(i.options.condition);
                        recurse(i.items);
                        conditionStack.pop();
                    }
                }
            }
        };

        recurse(schema.groupLayout);

        return [byInput, byGroup];
    }
);

export const getRequireCondition = (
    schema: NodeSchema,
    group: OfKind<Group, 'required'>
): Condition => {
    const result = analyseInputs(schema)[1].get(group.id);
    if (!result) {
        throw new Error('The given group was not part of the given schema');
    }
    return result;
};

export const getRequireConditions = (schema: NodeSchema): ReadonlyMap<InputId, Condition> => {
    return analyseInputs(schema)[0];
};
