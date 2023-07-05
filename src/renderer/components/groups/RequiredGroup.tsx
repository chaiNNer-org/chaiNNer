import { memo, useMemo } from 'react';
import { GenericInput } from '../../../common/common-types';
import { getUniqueKey } from '../../../common/group-inputs';
import { getRequireCondition } from '../../../common/nodes/required';
import { GroupProps } from './props';

export const RequiredGroup = memo(
    ({ inputs, nodeState, group, ItemRenderer }: GroupProps<'required'>) => {
        const { schema, testCondition } = nodeState;

        const condition = getRequireCondition(schema, group);
        const isRequired = useMemo(() => testCondition(condition), [condition, testCondition]);

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
