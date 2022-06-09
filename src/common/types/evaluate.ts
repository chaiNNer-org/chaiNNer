/* eslint-disable no-param-reassign */
import { assertNever } from '../util';
import { Expression, NamedExpression, NamedExpressionField } from './expression';
import { intersect } from './intersection';
import { isSubsetOf } from './relation';
import {
    AliasDefinition,
    AliasDefinitionEntry,
    StructDefinition,
    StructDefinitionEntry,
    TypeDefinitions,
} from './typedef';
import { NeverType, StructType, StructTypeField, Type } from './types';
import { union } from './union';

export type ErrorDetails =
    | {
          type: 'Generic parameter with fields';
          expression: NamedExpression;
          message: string;
      }
    | {
          type: 'Unknown alias parameter';
          expression: NamedExpression;
          definition: AliasDefinition;
          field: NamedExpressionField;
          message: string;
      }
    | {
          type: 'Unknown struct field';
          expression: NamedExpression;
          definition: StructDefinition;
          field: NamedExpressionField;
          message: string;
      }
    | {
          type: 'Unknown type definition';
          expression: NamedExpression;
          message: string;
      }
    | {
          type: 'Incompatible field type';
          expression: NamedExpression;
          definition: StructDefinition;
          field: {
              name: string;
              expression: Type;
              definition: Type;
          };
          message: string;
      }
    | {
          type: 'Incompatible parameter type';
          expression: NamedExpression;
          definition: AliasDefinition;
          parameter: {
              name: string;
              expression: Type;
              definition: Type;
          };
          message: string;
      };

export class EvaluationError extends Error {
    details: ErrorDetails;

    constructor(details: ErrorDetails) {
        super(`${details.type}: ${details.message}`);
        this.details = details;
    }
}

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

const evaluateAlias = (
    expression: NamedExpression,
    entry: AliasDefinitionEntry,
    definitions: TypeDefinitions,
    genericParameters: ReadonlyMap<string, Type>
): Type => {
    const unknownField = expression.fields.find(
        (f) => !entry.definition.parameterNames.has(f.name)
    );
    if (unknownField) {
        throw new EvaluationError({
            type: 'Unknown alias parameter',
            expression,
            definition: entry.definition,
            field: unknownField,
            message: `The alias definition for ${entry.definition.name} has no parameter ${unknownField.name}.`,
        });
    }

    if (entry.evaluatedParams === undefined) {
        entry.evaluatedParams = entry.definition.parameters.map((p) =>
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            evaluate(p.type, definitions)
        );
    }

    if (entry.definition.parameters.length === 0) {
        // non-generic alias
        if (entry.evaluated === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            entry.evaluated = evaluate(entry.definition.type, definitions);
        }
        return entry.evaluated;
    }

    // generic alias
    const eFields = new Map(expression.fields.map((f) => [f.name, f.type]));

    const aliasParams = new Map<string, Type>();
    for (let index = 0; index < entry.definition.parameters.length; index += 1) {
        const p = entry.definition.parameters[index];
        const pType = entry.evaluatedParams[index];
        const eField = eFields.get(p.name);

        let type;
        if (eField) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            type = evaluate(eField, definitions, genericParameters);

            if (!isSubsetOf(type, pType)) {
                throw new EvaluationError({
                    type: 'Incompatible parameter type',
                    expression,
                    definition: entry.definition,
                    parameter: { name: p.name, expression: type, definition: pType },
                    message: `The type expression of the ${p.name} parameter is not compatible with its type definition.`,
                });
            }
        } else {
            // default to definition type
            type = pType;
        }

        aliasParams.set(p.name, type);
    }

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return evaluate(entry.definition.type, definitions, aliasParams);
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
    expression: NamedExpression,
    entry: StructDefinitionEntry,
    definitions: TypeDefinitions,
    genericParameters: ReadonlyMap<string, Type>
): Type => {
    const unknownField = expression.fields.find((f) => !entry.definition.fieldNames.has(f.name));
    if (unknownField) {
        throw new EvaluationError({
            type: 'Unknown struct field',
            expression,
            definition: entry.definition,
            field: unknownField,
            message: `The struct definition for ${entry.definition.name} has no field ${unknownField.name}.`,
        });
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
                throw new EvaluationError({
                    type: 'Incompatible field type',
                    expression,
                    definition: entry.definition,
                    field: { name: f.name, expression: type, definition: f.type },
                    message: `The type expression of the ${f.name} field is not compatible with its type definition.`,
                });
            }
        } else {
            // default to definition type
            type = f.type;
        }
        fields.push(new StructTypeField(f.name, type));
    }
    return new StructType(expression.name, fields);
};

const evaluateNamed = (
    expression: NamedExpression,
    definitions: TypeDefinitions,
    genericParameters: ReadonlyMap<string, Type>
): Type => {
    // generic parameter
    const genericParam = genericParameters.get(expression.name);
    if (genericParam) {
        if (expression.fields.length > 0) {
            throw new EvaluationError({
                type: 'Generic parameter with fields',
                expression,
                message: `${expression.name} refers to a generic parameter and does not support fields.`,
            });
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

        throw new EvaluationError({
            type: 'Unknown type definition',
            expression,
            message:
                `Unknown type definition ${expression.name}. ` +
                `Did you mean ${names.slice(-3).join(', ')}?`,
        });
    }

    // alias
    if (entry.kind === 'alias') {
        return evaluateAlias(expression, entry, definitions, genericParameters);
    }

    return evaluateStruct(expression, entry, definitions, genericParameters);
};

const NO_GENERICS = new Map<never, never>();

/**
 * Evaluates the given expression. If a type is given, then the type will be returned as is.
 *
 * @param expression
 * @param definitions
 * @param genericParameters
 * @returns
 * @throws {@link EvaluationError}
 */
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
        case 'named':
            return evaluateNamed(expression, definitions, genericParameters);
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
