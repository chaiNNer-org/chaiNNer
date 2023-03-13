import { NeverType, evaluate, isDisjointWith } from '@chainner/navi';
import { memo, useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { InputItem, getUniqueKey } from '../../../common/group-inputs';
import { getChainnerScope } from '../../../common/types/chainner-scope';
import { fromJson } from '../../../common/types/json';
import { getInputValue } from '../../../common/util';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { GroupProps } from './props';
import { someInput } from './util';

export const ConditionalTypeGroup = memo(
    ({
        inputs,
        inputData,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
        group,
        ItemRenderer,
    }: GroupProps<'conditional-type'>) => {
        const isNodeInputLocked = useContextSelector(
            GlobalVolatileContext,
            (c) => c.isNodeInputLocked
        );
        const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);
        const fn = typeState.functions.get(nodeId);

        const inputType = fn?.inputs.get(group.options.input) ?? NeverType.instance;
        const inputHasDataValue = getInputValue(group.options.input, inputData) !== undefined;

        const conditionType = useMemo(() => {
            return evaluate(fromJson(group.options.condition), getChainnerScope());
        }, [group]);
        const disjoint = useMemo(
            () => isDisjointWith(inputType, conditionType),
            [inputType, conditionType]
        );

        let isEnabled = true;
        if (disjoint) {
            // the condition is not met
            isEnabled = false;
        } else {
            // If the input has not been assigned a value, then it will default to its declaration type.
            // This means that the the condition is trivially met, but this isn't what we want.
            // So we will only show the conditional inputs iff the input has been assigned a value.

            // eslint-disable-next-line no-lonely-if
            if (!inputHasDataValue && !typeState.isInputConnected(nodeId, group.options.input)) {
                // the input type is the declaration type
                isEnabled = false;
            }
        }

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
                    />
                ))}
            </>
        );
    }
);
