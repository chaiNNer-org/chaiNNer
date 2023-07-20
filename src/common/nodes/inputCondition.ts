import { Condition, Group, InputId, NodeSchema } from '../common-types';
import { lazyKeyed } from '../util';

const analyseInputs = lazyKeyed((schema: NodeSchema): ReadonlyMap<InputId, Condition> => {
    const byInput = new Map<InputId, Condition>();

    const conditionStack: Condition[] = [];
    const recurse = (inputs: readonly (InputId | Group)[]): void => {
        for (const i of inputs) {
            if (typeof i === 'object') {
                if (i.kind === 'conditional') {
                    conditionStack.push(i.options.condition);
                    recurse(i.items);
                    conditionStack.pop();
                }
            } else {
                byInput.set(i, {
                    kind: 'and',
                    items: [...conditionStack],
                });
            }
        }
    };

    recurse(schema.groupLayout);

    return byInput;
});

export const getInputCondition = (schema: NodeSchema, inputId: InputId): Condition | undefined => {
    return analyseInputs(schema).get(inputId);
};
