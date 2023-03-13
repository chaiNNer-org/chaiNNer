import { Type, evaluate, isDisjointWith } from '@chainner/navi';
import { memo, useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { Condition, OfKind } from '../../../common/common-types';
import { InputItem, getUniqueKey } from '../../../common/group-inputs';
import { getChainnerScope } from '../../../common/types/chainner-scope';
import { ExpressionJson, fromJson } from '../../../common/types/json';
import { getInputValue } from '../../../common/util';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { GroupProps } from './props';
import { someInput } from './util';

type Primitives = {
    [K in Exclude<Condition['kind'], 'and' | 'or' | 'not'>]: (
        condition: OfKind<Condition, K>
    ) => boolean;
};

const evaluateCondition = (condition: Condition, primitives: Primitives): boolean => {
    if (condition.kind === 'and') {
        return condition.items.every((c) => evaluateCondition(c, primitives));
    }
    if (condition.kind === 'or') {
        return condition.items.some((c) => evaluateCondition(c, primitives));
    }
    if (condition.kind === 'not') {
        return !evaluateCondition(condition.condition, primitives);
    }

    return primitives[condition.kind](condition as never);
};

const typeExpressionCache = new Map<ExpressionJson, Type>();
const getTypeFromExpression = (expression: ExpressionJson): Type => {
    let cached = typeExpressionCache.get(expression);
    if (cached === undefined) {
        cached = evaluate(fromJson(expression), getChainnerScope());
        typeExpressionCache.set(expression, cached);
    }
    return cached;
};

export const ConditionalGroup = memo(
    ({
        inputs,
        inputData,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
        group,
        ItemRenderer,
    }: GroupProps<'conditional'>) => {
        const isNodeInputLocked = useContextSelector(
            GlobalVolatileContext,
            (c) => c.isNodeInputLocked
        );
        const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);

        const isEnabled = useMemo(() => {
            return evaluateCondition(group.options.condition, {
                enum: (condition) => {
                    const { values } = condition;
                    const value = getInputValue(condition.enum, inputData);
                    return Array.isArray(values) ? values.includes(value) : values === value;
                },
                type: (condition) => {
                    const inputType = typeState.functions.get(nodeId)?.inputs.get(condition.input);
                    if (!inputType) return false;

                    const conditionType = getTypeFromExpression(condition.condition);

                    if (isDisjointWith(inputType, conditionType)) {
                        // the condition is not met
                        return false;
                    }

                    // If the input has not been assigned a value, then it will default to its declaration type.
                    // This means that the the condition is trivially met, but this isn't what we want.
                    // So we will only show the conditional inputs iff the input has been assigned a value.
                    if (
                        getInputValue(condition.input, inputData) !== undefined &&
                        !typeState.isInputConnected(nodeId, condition.input)
                    ) {
                        // the input type is the declaration type
                        return false;
                    }

                    return true;
                },
            });
        }, [group.options.condition, nodeId, inputData, typeState]);

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
