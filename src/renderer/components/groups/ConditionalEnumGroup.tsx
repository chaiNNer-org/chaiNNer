import { memo, useMemo } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { InputItem, getUniqueKey } from '../../../common/group-inputs';
import { BackendContext } from '../../contexts/BackendContext';
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
        const { schemata } = useContext(BackendContext);
        const { getNodeInputValue } = useContext(GlobalContext);

        const enumInput = useMemo(() => {
            const schema = schemata.get(schemaId);
            const input = schema.inputs.find((i) => i.id === group.options.enum);
            if (!input || input.kind !== 'dropdown') throw new Error('Invalid enum id');
            return input;
        }, [schemata, schemaId, group.options.enum]);

        const enumValue = getNodeInputValue(enumInput.id, inputData) ?? enumInput.def;

        const isNodeInputLocked = useContextSelector(
            GlobalVolatileContext,
            (c) => c.isNodeInputLocked
        );

        const showInput = (input: InputItem, index: number): boolean => {
            const cond = group.options.conditions[index];

            // enum has the right value
            if (typeof cond === 'object' ? cond.includes(enumValue) : cond === enumValue)
                return true;

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
