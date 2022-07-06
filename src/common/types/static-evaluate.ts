import { assertNever } from '../util';
import { Expression } from './expression';
import { intersect } from './intersection';
import { PrimitiveType, StaticType, UnionType } from './types';
import { union } from './union';

export class StaticEvaluationError extends Error {}

/**
 * Statically evaluates the given expression.
 *
 * The main difference to normal evaluation is that named expressions and structure types are not
 * supported and will cause a {@link StaticEvaluationError}.
 */
export const staticEvaluate = (expression: Expression): StaticType => {
    if (expression.underlying !== 'expression') {
        switch (expression.underlying) {
            case 'any':
            case 'never':
            case 'number':
            case 'string':
                return expression;
            case 'struct':
                throw new StaticEvaluationError(
                    `The struct type ${expression.toString()} cannot be statically evaluated.`
                );
            case 'union':
                for (const item of expression.items) {
                    if (item.underlying === 'struct') {
                        throw new StaticEvaluationError(
                            `The struct type ${expression.toString()} cannot be statically evaluated.`
                        );
                    }
                }
                return expression as UnionType<PrimitiveType>;
            default:
                return assertNever(expression);
        }
    }

    switch (expression.type) {
        case 'named':
            throw new StaticEvaluationError(
                `Named expressions are not supported during static evaluation.` +
                    ` The expression ${expression.toString()} cannot be evaluated`
            );
        case 'union':
            return union(...expression.items.map(staticEvaluate));
        case 'intersection':
            return intersect(...expression.items.map(staticEvaluate));
        case 'field-access':
            throw new StaticEvaluationError(
                `Field access is not supported during static evaluation.`
            );
        case 'builtin-function':
            throw new StaticEvaluationError(
                `The builtin function ${expression.functionName} is not supported during static evaluation.`
            );
        case 'match':
            throw new StaticEvaluationError(
                `The match expression ${expression.toString()} is not supported during static evaluation.`
            );
        default:
            return assertNever(expression);
    }
};
