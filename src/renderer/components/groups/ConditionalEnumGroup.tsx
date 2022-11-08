import { memo } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { Input } from '../../../common/common-types';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SchemaInput } from '../inputs/SchemaInput';
import { GroupProps } from './props';

export const ConditionalEnumGroup = memo(
    ({
        inputs,
        inputData,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
        group,
    }: GroupProps<'conditional-enum'>) => {
        const { getNodeInputValue } = useContext(GlobalContext);

        const enumInput = inputs[0];
        const enumValue = getNodeInputValue(enumInput.id, inputData) ?? enumInput.options[0].value;

        const isNodeInputLocked = useContextSelector(
            GlobalVolatileContext,
            (c) => c.isNodeInputLocked
        );

        const showInput = (input: Input): boolean => {
            // always show the main dropdown itself
            if (input === enumInput) return true;

            const cond = group.options.conditions[input.id];
            // no condition == always show input
            if (!cond) return true;

            // enum has the right value
            if (cond.includes(enumValue)) return true;

            // input is connected to another node
            return isNodeInputLocked(nodeId, input.id);
        };

        return (
            <>
                {inputs.filter(showInput).map((i) => (
                    <SchemaInput
                        input={i}
                        inputData={inputData}
                        inputSize={inputSize}
                        isLocked={isLocked}
                        key={i.id}
                        nodeId={nodeId}
                        schemaId={schemaId}
                    />
                ))}
            </>
        );
    }
);
