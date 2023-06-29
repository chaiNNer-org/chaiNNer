import { memo, useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { GenericInput } from '../../../common/common-types';
import { getUniqueKey } from '../../../common/group-inputs';
import { testInputConditionTypeState } from '../../../common/nodes/condition';
import { getRequireCondition } from '../../../common/nodes/required';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { GroupProps } from './props';

export const RequiredGroup = memo(
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
    }: GroupProps<'required'>) => {
        const schema = useContextSelector(BackendContext, (c) => c.schemata.get(schemaId));
        const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);

        const condition = getRequireCondition(schema, group);

        const isRequired = useMemo(
            () => testInputConditionTypeState(condition, inputData, nodeId, typeState),
            [condition, nodeId, inputData, typeState]
        );

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
                        setInputValue={setInputValue}
                    />
                ))}
            </>
        );
    }
);
