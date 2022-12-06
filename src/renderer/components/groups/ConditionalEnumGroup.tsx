import { memo } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { InputItem, getUniqueKey } from '../../../common/group-inputs';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { GroupProps } from './props';
import { someInput } from './util';

export const ConditionalEnumGroup = memo(
    ({
        inputs,
        inputData,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
        group,
        ItemRenderer,
    }: GroupProps<'conditional-enum'>) => {
        const { getNodeInputValue } = useContext(GlobalContext);

        const enumInput = inputs[0];
        const enumValue = getNodeInputValue(enumInput.id, inputData) ?? enumInput.def;

        const isNodeInputLocked = useContextSelector(
            GlobalVolatileContext,
            (c) => c.isNodeInputLocked
        );

        const showInput = (input: InputItem, index: number): boolean => {
            // always show the main dropdown itself
            if (index === 0) return true;

            const cond = group.options.conditions[index - 1];

            // enum has the right value
            if (cond.includes(enumValue)) return true;

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
                    />
                ))}
            </>
        );
    }
);
