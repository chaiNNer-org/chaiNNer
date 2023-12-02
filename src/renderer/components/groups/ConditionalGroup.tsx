import { memo, useMemo } from 'react';
import { InputItem, getUniqueKey } from '../../../common/group-inputs';
import { GroupProps } from './props';
import { someInput } from './util';

export const ConditionalGroup = memo(
    ({ inputs, nodeState, group, ItemRenderer }: GroupProps<'conditional'>) => {
        const { testCondition } = nodeState;
        const { condition } = group.options;

        const isEnabled = useMemo(() => testCondition(condition), [condition, testCondition]);

        const showInput = (input: InputItem): boolean => {
            if (isEnabled) return true;

            // input or some input of the group is connected to another node
            return someInput(input, ({ id }) => nodeState.connectedInputs.has(id));
        };

        return (
            <>
                {inputs.filter(showInput).map((item) => (
                    <ItemRenderer
                        item={item}
                        key={getUniqueKey(item)}
                        nodeState={nodeState}
                    />
                ))}
            </>
        );
    },
);
