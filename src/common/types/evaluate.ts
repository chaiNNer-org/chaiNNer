/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-param-reassign */
import { EMPTY_MAP, assertNever } from '../util';
import {
    BuiltinFunctionExpression,
    Expression,
    FieldAccessExpression,
    MatchArm,
    MatchExpression,
    NamedExpression,
    NamedExpressionField,
} from './expression';
import { intersect } from './intersection';
import { isSubsetOf } from './relation';
import {
    AliasDefinition,
    AliasDefinitionEntry,
    AliasParameterDefinition,
    BuiltinFunctionDefinition,
    StructDefinition,
    StructDefinitionEntry,
    TypeDefinitions,
} from './typedef';
import { NeverType, StructType, StructTypeField, Type } from './types';
import { union } from './union';
import { without } from './without';

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
          type: 'Unknown builtin function';
          expression: BuiltinFunctionExpression;
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
      }
    | {
          type: 'Invalid structure definition';
          definition: StructDefinition;
          details: ErrorDetails;
          message: string;
      }
    | {
          type: 'Invalid alias definition type';
          definition: AliasDefinition;
          details: ErrorDetails;
          message: string;
      }
    | {
          type: 'Invalid alias definition parameter type';
          definition: AliasDefinition;
          parameter: AliasParameterDefinition;
          details: ErrorDetails;
          message: string;
      }
    | {
          type: 'Invalid field access';
          expression: FieldAccessExpression;
          fullExpressionType: Type;
          offendingType: Type;
          message: string;
      }
    | {
          type: 'Incorrect builtin function argument count';
          expression: BuiltinFunctionExpression;
          definition: BuiltinFunctionDefinition;
          message: string;
      }
    | {
          type: 'Incompatible argument type';
          expression: BuiltinFunctionExpression;
          definition: BuiltinFunctionDefinition;
          argument: {
              index: number;
              expression: Type;
              definition: Type;
          };
          message: string;
      }
    | {
          type: 'Invalid struct match arm';
          expression: MatchExpression;
          arm: MatchArm;
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
        entry.evaluatedParams = entry.definition.parameters.map((p) => {
            try {
                return evaluate(p.type, definitions);
            } catch (error: unknown) {
                if (error instanceof EvaluationError) {
                    throw new EvaluationError({
                        type: 'Invalid alias definition parameter type',
                        definition: entry.definition,
                        parameter: p,
                        details: error.details,
                        message: `The alias definition parameter type for ${entry.definition.name}.${p.name} is invalid.`,
                    });
                }
                throw error;
            }
        });
    }

    if (entry.evaluated === undefined) {
        try {
            const params = new Map(
                entry.definition.parameters.map((p, i) => [p.name, entry.evaluatedParams![i]])
            );
            entry.evaluated = evaluate(entry.definition.type, definitions, params);
        } catch (error: unknown) {
            if (error instanceof EvaluationError) {
                throw new EvaluationError({
                    type: 'Invalid alias definition type',
                    definition: entry.definition,
                    details: error.details,
                    message: `The alias definition type for ${entry.definition.name} is invalid.`,
                });
            }
            throw error;
        }
    }

    if (entry.definition.parameters.length === 0) {
        // non-generic alias instantiation
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

    return evaluate(entry.definition.type, definitions, aliasParams);
};

const evaluateStructDefinition = (
    def: StructDefinition,
    definitions: TypeDefinitions
): StructType | NeverType => {
    const fields: StructTypeField[] = [];
    for (const f of def.fields) {
        let type;
        try {
            type = evaluate(f.type, definitions);
        } catch (error: unknown) {
            if (error instanceof EvaluationError) {
                throw new EvaluationError({
                    type: 'Invalid structure definition',
                    definition: def,
                    details: error.details,
                    message: `The structure definition for ${def.name} is invalid.`,
                });
            }
            throw error;
        }
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

    entry.evaluated ??= evaluateStructDefinition(entry.definition, definitions);
    if (entry.evaluated.type === 'never') return NeverType.instance;

    const eFields = new Map(expression.fields.map((f) => [f.name, f.type]));

    const fields: StructTypeField[] = [];
    for (const f of entry.evaluated.fields) {
        const eField = eFields.get(f.name);
        let type;
        if (eField) {
            type = evaluate(eField, definitions, genericParameters);
            if (type.type === 'never') return NeverType.instance;

            if (!isSubsetOf(type, f.type)) {
                throw new EvaluationError({
                    type: 'Incompatible field type',
                    expression,
                    definition: entry.definition,
                    field: { name: f.name, expression: type, definition: f.type },
                    message: `The type ${type.toString()} of the ${
                        f.name
                    } field is not compatible with its type definition ${f.type.toString()}.`,
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

const evaluateFieldAccess = (
    expression: FieldAccessExpression,
    definitions: TypeDefinitions,
    genericParameters: ReadonlyMap<string, Type>
): Type => {
    const type = evaluate(expression.of, definitions, genericParameters);
    if (type.type === 'never') return NeverType.instance;
    if (type.type === 'any') {
        throw new EvaluationError({
            type: 'Invalid field access',
            expression,
            fullExpressionType: type,
            offendingType: type,
            message: `The \`any\` type is not guaranteed to have a field \`${expression.field}\`.`,
        });
    }

    const types = type.type === 'union' ? type.items : [type];
    const accessed: Type[] = [];
    for (const t of types) {
        if (t.type !== 'struct') {
            throw new EvaluationError({
                type: 'Invalid field access',
                expression,
                fullExpressionType: type,
                offendingType: t,
                message: `Primitive types do not have fields.`,
            });
        }

        const field = t.fields.find((f) => f.name === expression.field);
        if (!field) {
            throw new EvaluationError({
                type: 'Invalid field access',
                expression,
                fullExpressionType: type,
                offendingType: t,
                message: `The ${t.name} structure does not define a field \`${expression.field}\`.`,
            });
        }

        accessed.push(field.type);
    }
    return union(...accessed);
};

const evaluateBuiltinFunction = (
    expression: BuiltinFunctionExpression,
    definitions: TypeDefinitions,
    genericParameters: ReadonlyMap<string, Type>
): Type => {
    const entry = definitions.getFunction(expression.functionName);
    if (entry === undefined) {
        throw new EvaluationError({
            type: 'Unknown builtin function',
            expression,
            message: `No builtin function ${expression.functionName} available.`,
        });
    }

    if (entry.definition.args.length !== expression.args.length) {
        throw new EvaluationError({
            type: 'Incorrect builtin function argument count',
            expression,
            definition: entry.definition,
            message: `${expression.functionName} expected ${entry.definition.args.length} but got ${expression.args.length}.`,
        });
    }

    if (!entry.evaluatedArgs) {
        entry.evaluatedArgs = entry.definition.args.map((arg) => evaluate(arg, definitions));
    }

    const args = expression.args.map((arg) => evaluate(arg, definitions, genericParameters));

    for (let i = 0; i < args.length; i += 1) {
        const eType = args[i];
        const dType = entry.evaluatedArgs[i];

        if (!isSubsetOf(eType, dType)) {
            throw new EvaluationError({
                type: 'Incompatible argument type',
                expression,
                definition: entry.definition,
                argument: { index: i, expression: eType, definition: dType },
                message: `The supplied argument type ${eType.toString()} is not compatible with the definition type.`,
            });
        }
    }

    return entry.definition.fn(...args);
};

const evaluateMatch = (
    expression: MatchExpression,
    definitions: TypeDefinitions,
    genericParameters: ReadonlyMap<string, Type>
): Type => {
    const structs = new Map<MatchArm, Type>();
    for (const arm of expression.arms) {
        if (typeof arm.pattern === 'string') {
            const entry = definitions.get(arm.pattern);
            if (entry === undefined) {
                throw new EvaluationError({
                    type: 'Invalid struct match arm',
                    expression,
                    arm,
                    message: `There is no struct definition with the name ${arm.pattern}.`,
                });
            }
            if (entry.kind !== 'struct') {
                throw new EvaluationError({
                    type: 'Invalid struct match arm',
                    expression,
                    arm,
                    message: `The type definition with the name ${arm.pattern} is not a struct.`,
                });
            }
            entry.evaluated ??= evaluateStructDefinition(entry.definition, definitions);
            structs.set(arm, entry.evaluated);
        }
    }

    let type = evaluate(expression.of, definitions, genericParameters);
    if (type.type === 'never') return NeverType.instance;

    const withBinding = (arm: MatchArm, armType: Type): ReadonlyMap<string, Type> => {
        if (arm.binding === undefined) return genericParameters;
        const copy = new Map(genericParameters);
        copy.set(arm.binding, armType);
        return copy;
    };

    const matchTypes: Type[] = [];
    for (const arm of expression.arms) {
        const armType = typeof arm.pattern === 'string' ? structs.get(arm)! : arm.pattern;
        const t = intersect(armType, type);
        if (t.type !== 'never') {
            matchTypes.push(evaluate(arm.to, definitions, withBinding(arm, t)));
            type = without(type, armType);
        }
    }

    return union(...matchTypes);
};

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
    genericParameters: ReadonlyMap<string, Type> = EMPTY_MAP
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
        case 'field-access':
            return evaluateFieldAccess(expression, definitions, genericParameters);
        case 'builtin-function':
            return evaluateBuiltinFunction(expression, definitions, genericParameters);
        case 'match':
            return evaluateMatch(expression, definitions, genericParameters);
        default:
            return assertNever(expression);
    }
};
