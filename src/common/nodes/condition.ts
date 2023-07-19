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

export const isTautology = (condition: Condition): boolean => {
    // This is only an approximation, but it should be good enough for our purposes.
    return (
        testCondition(condition, {
            enum: () => false,
            type: () => false,
        }) &&
        testCondition(condition, {
            enum: () => true,
            type: () => true,
        })
    );
};

const AND_OR_OTHER = {
    and: 'or',
    or: 'and',
} as const;

export const simplifyCondition = (condition: Condition): Condition => {
    if (condition.kind === 'not') {
        const inner = simplifyCondition(condition.condition);
        if (inner.kind === 'not') {
            return inner.condition;
        }
        if (inner.kind === 'and' || inner.kind === 'or') {
            return { kind: AND_OR_OTHER[inner.kind], items: inner.items };
        }
        return { kind: 'not', condition: inner };
    }

    if (condition.kind === 'and' || condition.kind === 'or') {
        const items: Condition[] = [];
        for (const item of condition.items) {
            const simplified = simplifyCondition(item);
            if (simplified.kind === condition.kind) {
                items.push(...simplified.items);
            } else if (
                simplified.kind === AND_OR_OTHER[condition.kind] &&
                simplified.items.length === 0
            ) {
                // we found either a True in an OR or a False in an AND
                return simplified;
            } else {
                items.push(simplified);
            }
        }
        if (items.length === 1) {
            return items[0];
        }
        return { kind: condition.kind, items };
    }

    return condition;
};
