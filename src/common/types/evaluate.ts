import { assertNever } from '../util';
import { Expression, StructExpression } from './expression';
import { intersect } from './intersection';
import { isSubsetOf } from './relation';
import { StructDefinition, TypeDefinitions } from './typedef';
import { NeverType, StructType, StructTypeField, Type } from './types';
import { union } from './union';

/**
 * Implements an F1 score based on bi-grams.
 */
const getSimilarityScore = (a: string, b: string): number => {
    const getBiGrams = (s: string): Set<string> => {
        const bi = new Set<string>();
        for (let i = 1; i < s.length; i += 1) {
            bi.add(s.substring(i - 1, i + 1));
        }
        return bi;
    };

    const aBi = getBiGrams(a);
    const bBi = getBiGrams(b);
    if (aBi.size === 0 || bBi.size === 0) return 0;

    const intersection = [...aBi].filter((g) => bBi.has(g));

    return (2 * intersection.length) / (aBi.size + bBi.size);
};

const evaluateStructDefinition = (
    def: StructDefinition,
    definitions: TypeDefinitions
): StructType | NeverType => {
    const fields: StructTypeField[] = [];
    for (const f of def.fields) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const type = evaluate(f.type, definitions);
        if (type.type === 'never') return NeverType.instance;
        fields.push(new StructTypeField(f.name, type));
    }
    return new StructType(def.name, fields);
};
const evaluateStruct = (
    expression: StructExpression,
    definitions: TypeDefinitions,
    genericParameters: ReadonlyMap<string, Type>
): Type => {
    // generic parameter
    const genericParam = genericParameters.get(expression.name);
    if (genericParam) {
        if (expression.fields.length > 0) {
            throw new Error(
                `Invalid expression ${expression.toString()}. ` +
                    `${expression.name} refers to a generic parameter and does not support fields.`
            );
        }
        return genericParam;
    }

    // definition
    const entry = definitions.get(expression.name);
    if (entry === undefined) {
        const names = [...definitions.names()]
            .map((name) => {
                return { name, score: getSimilarityScore(name, expression.name) };
            })
            .sort((a, b) => a.score - b.score)
            .map((n) => n.name);

        throw new Error(
            `Invalid expression ${expression.toString()}. ` +
                `Unknown type definition ${expression.name}. ` +
                `Did you mean ${names.slice(-3).join(', ')}?`
        );
    }

    // alias
    if (entry.kind === 'alias') {
        if (expression.fields.length !== 0)
            throw new Error(
                `Invalid expression ${expression.toString()}. ` +
                    `${expression.name} resolves to: ${entry.definition.toString()}. ` +
                    `Aliases do not allow fields.`
            );

        if (entry.evaluated === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            entry.evaluated = evaluate(entry.definition.type, definitions);
        }
        return entry.evaluated;
    }

    // struct
    for (const f of expression.fields) {
        if (!entry.definition.fieldNames.has(f.name)) {
            throw new Error(
                `Invalid struct: ${expression.toString()}. ` +
                    `The struct definition ${entry.definition.toString()} has no field ${f.name}.`
            );
        }
    }

    if (entry.evaluated === undefined) {
        entry.evaluated = evaluateStructDefinition(entry.definition, definitions);
    }
    if (entry.evaluated.type === 'never') return NeverType.instance;

    const eFields = new Map(expression.fields.map((f) => [f.name, f.type]));

    const fields: StructTypeField[] = [];
    for (const f of entry.evaluated.fields) {
        const eField = eFields.get(f.name);
        let type;
        if (eField) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            type = evaluate(eField, definitions, genericParameters);
            if (type.type === 'never') return NeverType.instance;

            if (!isSubsetOf(type, f.type)) {
                throw new Error(
                    `Invalid struct instantiation. ` +
                        `The expression ${expression.toString()} is not compatible with the definition ${entry.definition.toString()}. ` +
                        `The field ${
                            f.name
                        } evaluates to ${type.toString()} which is not compatible with the definition type ${f.type.toString()}.`
                );
            }
        } else {
            // default to definition type
            type = f.type;
        }
        fields.push(new StructTypeField(f.name, type));
    }
    return new StructType(expression.name, fields);
};

const NO_GENERICS = new Map<never, never>();

export const evaluate = (
    expression: Expression,
    definitions: TypeDefinitions,
    genericParameters: ReadonlyMap<string, Type> = NO_GENERICS
): Type => {
    if (expression.underlying !== 'expression') {
        // type
        return expression;
    }

    switch (expression.type) {
        case 'struct':
            return evaluateStruct(expression, definitions, genericParameters);
        case 'union':
            return union(
                ...expression.items.map((e) => evaluate(e, definitions, genericParameters))
            );
        case 'intersection':
            return intersect(
                ...expression.items.map((e) => evaluate(e, definitions, genericParameters))
            );
        default:
            return assertNever(expression);
    }
};
