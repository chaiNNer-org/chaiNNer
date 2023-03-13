import { memo, useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { GenericInput } from '../../../common/common-types';
import { getUniqueKey } from '../../../common/group-inputs';
import { testInputCondition } from '../../../common/nodes/condition';
import { getFullRequireCondition } from '../../../common/nodes/required';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { GroupProps } from './props';

export const RequiredGroup = memo(
    ({
        inputs,
        inputData,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
        group,
        ItemRenderer,
    }: GroupProps<'required'>) => {
        const schema = useContextSelector(BackendContext, (c) => c.schemata.get(schemaId));
        const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);

        const condition = useMemo(() => getFullRequireCondition(schema, group), [schema, group]);

        const isRequired = useMemo(() => {
            return testInputCondition(
                condition,
                inputData,
                (id) => typeState.functions.get(nodeId)?.inputs.get(id),
                (id) => typeState.isInputConnected(nodeId, id)
            );
        }, [condition, nodeId, inputData, typeState]);

        const requiredInputs: GenericInput[] = useMemo(() => {
            return inputs.map((i) => ({ ...i, optional: false }));
        }, [inputs]);

        return (
            <>
                {(isRequired ? requiredInputs : inputs).map((item) => (
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
