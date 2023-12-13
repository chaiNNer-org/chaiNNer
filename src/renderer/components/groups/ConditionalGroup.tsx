import { memo, useMemo } from 'react';
import { getUniqueKey } from '../../../common/group-inputs';
import { WithInputContext } from '../../contexts/InputContext';
import { GroupProps } from './props';
import { someInput } from './util';

export const ConditionalGroup = memo(
    ({ inputs, nodeState, group, ItemRenderer }: GroupProps<'conditional'>) => {
        const { testCondition } = nodeState;
        const { condition } = group.options;

        const isEnabled = useMemo(() => testCondition(condition), [condition, testCondition]);

        if (isEnabled) {
            return (
                <>
                    {inputs.map((item) => (
                        <ItemRenderer
                            item={item}
                            key={getUniqueKey(item)}
                            nodeState={nodeState}
                        />
                    ))}
                </>
            );
        }

        return (
            <>
                {inputs.map((item) => {
                    // input or some input of the group is connected to another node
                    const show = someInput(item, ({ id }) => nodeState.connectedInputs.has(id));
                    if (!show) return null;

                    return (
                        <WithInputContext
                            conditionallyInactive
                            key={getUniqueKey(item)}
                        >
                            <ItemRenderer
                                item={item}
                                nodeState={nodeState}
                            />
                        </WithInputContext>
                    );
                })}
            </>
        );
    }
);
