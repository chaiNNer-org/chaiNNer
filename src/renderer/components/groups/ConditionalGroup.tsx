import { memo, useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { InputItem, getUniqueKey } from '../../../common/group-inputs';
import { testInputConditionTypeState } from '../../../common/nodes/condition';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { GroupProps } from './props';
import { someInput } from './util';

export const ConditionalGroup = memo(
    ({
        inputs,
        inputData,
        setInputValue,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
        group,
        ItemRenderer,
    }: GroupProps<'conditional'>) => {
        const { condition } = group.options;

        const isNodeInputLocked = useContextSelector(
            GlobalVolatileContext,
            (c) => c.isNodeInputLocked
        );
        const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);

        const isEnabled = useMemo(
            () => testInputConditionTypeState(condition, inputData, nodeId, typeState),
            [condition, nodeId, inputData, typeState]
        );

        const showInput = (input: InputItem): boolean => {
            if (isEnabled) return true;

            // input or some input of the group is connected to another node
            return someInput(input, ({ id }) => isNodeInputLocked(nodeId, id));
        };

        return (
            <>
                {inputs.filter(showInput).map((item) => (
                    <ItemRenderer
                        inputData={inputData}
                        inputSize={inputSize}
                        isLocked={isLocked}
                        item={item}
                        key={getUniqueKey(item)}
                        nodeId={nodeId}
                        schemaId={schemaId}
                        setInputValue={setInputValue}
                    />
                ))}
            </>
        );
    }
);
