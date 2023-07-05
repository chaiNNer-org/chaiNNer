import { memo, useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { GenericInput } from '../../../common/common-types';
import { getUniqueKey } from '../../../common/group-inputs';
import { testInputConditionTypeState } from '../../../common/nodes/condition';
import { getRequireCondition } from '../../../common/nodes/required';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { GroupProps } from './props';

export const RequiredGroup = memo(
    ({ inputs, nodeState, group, ItemRenderer }: GroupProps<'required'>) => {
        const { id: nodeId, inputData, schema } = nodeState;

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
                        item={item}
                        key={getUniqueKey(item)}
                        nodeState={nodeState}
                    />
                ))}
            </>
        );
    }
);
