import { Type, evaluate, isDisjointWith } from '@chainner/navi';
import { Condition, InputData, InputId, OfKind } from '../common-types';
import { getChainnerScope } from '../types/chainner-scope';
import { ExpressionJson, fromJson } from '../types/json';
import { getInputValue } from '../util';
import { TypeState } from './TypeState';

type Primitives = {
    [K in Exclude<Condition['kind'], 'and' | 'or' | 'not'>]: (
        condition: OfKind<Condition, K>
    ) => boolean;
};

const testCondition = (condition: Condition, primitives: Primitives): boolean => {
    if (condition.kind === 'and') {
        return condition.items.every((c) => testCondition(c, primitives));
    }
    if (condition.kind === 'or') {
        return condition.items.some((c) => testCondition(c, primitives));
    }
    if (condition.kind === 'not') {
        return !testCondition(condition.condition, primitives);
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

export const testInputCondition = (
    condition: Condition,
    inputData: InputData,
    getInputType: (inputId: InputId) => Type | undefined,
    isConnected: (inputId: InputId) => boolean
): boolean => {
    return testCondition(condition, {
        enum: (c) => {
            const { values } = c;
            const value = getInputValue(c.enum, inputData);
            return Array.isArray(values) ? values.includes(value) : values === value;
        },
        type: ({ input, condition: type }) => {
            const inputType = getInputType(input);
            if (!inputType) return false;

            const conditionType = getTypeFromExpression(type);

            if (isDisjointWith(inputType, conditionType)) {
                // the condition is not met
                return false;
            }

            // If the input has not been assigned a value, then it will default to its declaration type.
            // This means that the the condition is trivially met, but this isn't what we want.
            // So we will only show the conditional inputs if the input has been assigned a value.
            if (getInputValue(input, inputData) === undefined && !isConnected(input)) {
                // the input type is the declaration type
                return false;
            }

            return true;
        },
    });
};

export const testInputConditionTypeState = (
    condition: Condition,
    inputData: InputData,
    nodeId: string,
    typeState: TypeState
): boolean => {
    return testInputCondition(
        condition,
        inputData,
        (id) => typeState.functions.get(nodeId)?.inputs.get(id),
        (id) => typeState.edges.isInputConnected(nodeId, id)
    );
};
