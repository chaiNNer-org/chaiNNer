import { assertNever } from '../util';
import { Expression, StructExpression } from './expression';
import { intersect } from './intersection';
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
const evaluateStruct = (expression: StructExpression, definitions: TypeDefinitions): Type => {
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
            // TODO: Should this check that the evaluated type is a subset of def type?
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            type = evaluate(eField, definitions);
            if (type.type === 'never') return NeverType.instance;
        } else {
            // default to definition type
            type = f.type;
        }
        fields.push(new StructTypeField(f.name, type));
    }
    return new StructType(expression.name, fields);
};

export const evaluate = (expression: Expression, definitions: TypeDefinitions): Type => {
    if (expression.underlying !== 'expression') {
        // type
        return expression;
    }

    switch (expression.type) {
        case 'struct':
            return evaluateStruct(expression, definitions);
        case 'union':
            return union(...expression.items.map((e) => evaluate(e, definitions)));
        case 'intersection':
            return intersect(...expression.items.map((e) => evaluate(e, definitions)));
        default:
            return assertNever(expression);
    }
};
