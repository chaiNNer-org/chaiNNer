import { Type, evaluate, isDisjointWith } from '@chainner/navi';
import { Condition, InputData, InputId, NodeSchema, OfKind } from '../common-types';
import { getChainnerScope } from '../types/chainner-scope';
import { ExpressionJson, fromJson } from '../types/json';
import { EMPTY_ARRAY, getInputValue, lazyKeyed } from '../util';
import { getGroupStacks } from './groupStacks';

export type TestFn = (condition: Condition) => boolean;

type Primitives = {
    [K in Exclude<Condition['kind'], 'and' | 'or' | 'not'>]: (
        condition: OfKind<Condition, K>,
        test: TestFn
    ) => boolean;
};

const createTest = (primitives: Primitives): TestFn => {
    const test = lazyKeyed((condition: Condition): boolean => {
        if (condition.kind === 'and') {
            return condition.items.every(test);
        }
        if (condition.kind === 'or') {
            return condition.items.some(test);
        }
        if (condition.kind === 'not') {
            return !test(condition.condition);
        }

        return primitives[condition.kind](condition as never, test);
    });

    return test;
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

export const testForInputCondition = (
    inputData: InputData,
    schema: NodeSchema,
    getInputType: (inputId: InputId) => Type | undefined,
    isConnected: (inputId: InputId) => boolean
): TestFn => {
    const { inputConditions } = getGroupStacks(schema);

    return createTest({
        enum: (c, test) => {
            const { values } = c;
            const value = getInputValue(c.enum, inputData);

            // no value, so let's return false
            if (value === undefined) return false;
            // the value is not selected
            if (!values.includes(value)) return false;

            // the value of an input is only defined if its conditions are met
            const conditions = inputConditions.get(c.enum) ?? EMPTY_ARRAY;
            if (!conditions.every(test)) return false;

            return true;
        },
        type: ({ input, condition: type, ifNotConnected }) => {
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
                return ifNotConnected;
            }

            return true;
        },
    });
};

export const testInputCondition = (
    condition: Condition,
    inputData: InputData,
    schema: NodeSchema,
    getInputType: (inputId: InputId) => Type | undefined,
    isConnected: (inputId: InputId) => boolean
): boolean => {
    return testForInputCondition(inputData, schema, getInputType, isConnected)(condition);
};

export const isTautology = (condition: Condition): boolean => {
    // This is only an approximation, but it should be good enough for our purposes.
    return (
        createTest({
            enum: () => false,
            type: () => false,
        })(condition) &&
        createTest({
            enum: () => true,
            type: () => true,
        })(condition)
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
