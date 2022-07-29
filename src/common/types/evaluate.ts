/* eslint-disable @typescript-eslint/no-use-before-define */

import { assertNever } from '../util';
import {
    Expression,
    FieldAccessExpression,
    FunctionCallExpression,
    FunctionDefinition,
    MatchArm,
    MatchExpression,
    NamedExpression,
    NamedExpressionField,
    ScopeExpression,
    StructDefinition,
    VariableDefinition,
} from './expression';
import { intersect } from './intersection';
import { isSubsetOf } from './relation';
import {
    BuiltinFunctionDefinition,
    NameResolutionError,
    ResolvedName,
    Scope,
    ScopeBuilder,
    ScopeBuiltinFunctionDefinition,
    ScopeFunctionDefinition,
    ScopeParameterDefinition,
    ScopeStructDefinition,
    ScopeVariableDefinition,
} from './scope';
import { NeverType, StructType, StructTypeField, Type } from './types';
import { union } from './union';
import { without } from './without';

export type ErrorDetails =
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
          type: 'Unknown function';
          expression: FunctionCallExpression;
          similarNames: string[];
          message: string;
      }
    | {
          type: 'Not a function';
          expression: FunctionCallExpression;
          message: string;
      }
    | {
          type: 'Not a struct';
          expression: NamedExpression;
          message: string;
      }
    | {
          type: 'Unknown named';
          expression: NamedExpression;
          similarNames: string[];
          message: string;
      }
    | {
          type: 'Cannot reference function';
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
          type: 'Invalid structure definition';
          definition: StructDefinition;
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
          type: 'Incorrect function argument count';
          expression: FunctionCallExpression;
          definition: BuiltinFunctionDefinition | FunctionDefinition;
          message: string;
      }
    | {
          type: 'Incompatible argument type';
          expression: FunctionCallExpression;
          definition: BuiltinFunctionDefinition | FunctionDefinition;
          argument: {
              index: number;
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

const evaluateStructDefinition = (def: StructDefinition, scope: Scope): StructType | NeverType => {
    const fields: StructTypeField[] = [];
    for (const f of def.fields) {
        let type;
        try {
            type = evaluate(f.type, scope);
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
    scope: Scope,
    definition: ScopeStructDefinition,
    definitionScope: Scope
): Type => {
    // eslint-disable-next-line no-param-reassign
    definition.default ??= evaluateStructDefinition(definition.definition, definitionScope);
    if (definition.default.type === 'never') return NeverType.instance;

    // no fields
    if (expression.fields.length === 0) {
        return definition.default;
    }

    // check for unknown fields
    const unknownField = expression.fields.find(
        (f) => !definition.definition.fieldNames.has(f.name)
    );
    if (unknownField) {
        throw new EvaluationError({
            type: 'Unknown struct field',
            expression,
            definition: definition.definition,
            field: unknownField,
            message: `The struct definition for ${definition.definition.name} has no field ${unknownField.name}.`,
        });
    }

    const expressionFields = new Map(expression.fields.map((f) => [f.name, f.type]));

    const fields: StructTypeField[] = [];
    for (const dField of definition.default.fields) {
        const eField = expressionFields.get(dField.name);
        let type;
        if (eField) {
            type = evaluate(eField, scope);
            if (type.type === 'never') return NeverType.instance;

            if (!isSubsetOf(type, dField.type)) {
                throw new EvaluationError({
                    type: 'Incompatible field type',
                    expression,
                    definition: definition.definition,
                    field: { name: dField.name, expression: type, definition: dField.type },
                    message: `The type ${type.toString()} of the ${
                        dField.name
                    } field is not compatible with its type definition ${dField.type.toString()}.`,
                });
            }
        } else {
            // default to definition type
            type = dField.type;
        }
        fields.push(new StructTypeField(dField.name, type));
    }
    return new StructType(expression.name, fields);
};

const resolveNamed = (
    expression: NamedExpression,
    currentScope: Scope
): ResolvedName<ScopeStructDefinition | ScopeVariableDefinition | ScopeParameterDefinition> => {
    let resolved;
    try {
        resolved = currentScope.get(expression.name);
    } catch (error: unknown) {
        if (error instanceof NameResolutionError) {
            throw new EvaluationError({
                type: 'Unknown named',
                expression,
                similarNames: error.similar,
                message: error.message,
            });
        }
        throw error;
    }

    const { definition, scope } = resolved;
    if (definition.type === 'function' || definition.type === 'builtin-function') {
        throw new EvaluationError({
            type: 'Cannot reference function',
            expression,
            message: `The name ${expression.name} resolves to a ${resolved.definition.type} and not a struct.`,
        });
    }

    return { definition, scope };
};
const evaluateNamed = (expression: NamedExpression, scope: Scope): Type => {
    const { definition, scope: definitionScope } = resolveNamed(expression, scope);

    // parameter
    if (definition.type === 'parameter') {
        return definition.value;
    }

    // variable
    if (definition.type === 'variable') {
        if (expression.fields.length > 0) {
            throw new EvaluationError({
                type: 'Not a struct',
                expression,
                message: `${expression.name} is a variable and does not support struct fields.`,
            });
        }

        if (definition.value === undefined) {
            definition.value = evaluate(definition.definition.value, definitionScope);
        }

        return definition.value;
    }

    // struct
    return evaluateStruct(expression, scope, definition, definitionScope);
};

const evaluateFieldAccess = (expression: FieldAccessExpression, scope: Scope): Type => {
    const type = evaluate(expression.of, scope);
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
        if (t.underlying === 'number' || t.underlying === 'string') {
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

const resolveFunction = (
    expression: FunctionCallExpression,
    currentScope: Scope
): ResolvedName<ScopeFunctionDefinition | ScopeBuiltinFunctionDefinition> => {
    let resolved;
    try {
        resolved = currentScope.get(expression.functionName);
    } catch (error: unknown) {
        if (error instanceof NameResolutionError) {
            throw new EvaluationError({
                type: 'Unknown function',
                expression,
                similarNames: error.similar,
                message: error.message,
            });
        }
        throw error;
    }

    const { definition, scope } = resolved;
    if (definition.type === 'function' || definition.type === 'builtin-function') {
        return { definition, scope };
    }

    throw new EvaluationError({
        type: 'Not a function',
        expression,
        message: `The name ${expression.functionName} resolves to a ${resolved.definition.type} and not a function.`,
    });
};
const evaluateFunctionCall = (expression: FunctionCallExpression, scope: Scope): Type => {
    const { definition, scope: definitionScope } = resolveFunction(expression, scope);

    // check argument number
    if (definition.type === 'builtin-function' && definition.definition.varArgs) {
        if (definition.definition.parameters.length > expression.args.length) {
            throw new EvaluationError({
                type: 'Incorrect function argument count',
                expression,
                definition: definition.definition,
                message: `${expression.functionName} expected at least ${definition.definition.parameters.length} but got ${expression.args.length}.`,
            });
        }
    } else if (definition.definition.parameters.length !== expression.args.length) {
        throw new EvaluationError({
            type: 'Incorrect function argument count',
            expression,
            definition: definition.definition,
            message: `${expression.functionName} expected ${definition.definition.parameters.length} but got ${expression.args.length}.`,
        });
    }

    // evaluate parameter types
    if (!definition.parameters) {
        if (definition.type === 'builtin-function') {
            definition.parameters = definition.definition.parameters.map((p) =>
                evaluate(p, definitionScope)
            );
        } else {
            definition.parameters = definition.definition.parameters.map((p) =>
                evaluate(p.type, definitionScope)
            );
        }
    }
    if (
        definition.type === 'builtin-function' &&
        !definition.varArgs &&
        definition.definition.varArgs
    ) {
        definition.varArgs = evaluate(definition.definition.varArgs, definitionScope);
    }

    // evaluate arguments
    const args = expression.args.map((arg) => evaluate(arg, scope));

    // check argument types
    for (let i = 0; i < definition.parameters.length; i += 1) {
        const eType = args[i];
        const dType = definition.parameters[i];

        if (!isSubsetOf(eType, dType)) {
            throw new EvaluationError({
                type: 'Incompatible argument type',
                expression,
                definition: definition.definition,
                argument: { index: i, expression: eType, definition: dType },
                message: `The supplied argument type ${eType.toString()} is not compatible with the definition type.`,
            });
        }
    }
    if (definition.varArgs) {
        for (let i = definition.parameters.length; i < args.length; i += 1) {
            const eType = args[i];
            const dType = definition.varArgs;

            if (!isSubsetOf(eType, dType)) {
                throw new EvaluationError({
                    type: 'Incompatible argument type',
                    expression,
                    definition: definition.definition,
                    argument: { index: i, expression: eType, definition: dType },
                    message: `The supplied argument type ${eType.toString()} is not compatible with the definition type.`,
                });
            }
        }
    }

    // run function
    if (definition.type === 'function') {
        const functionScope = new ScopeBuilder('function scope', definitionScope);
        definition.definition.parameters.forEach(({ name }, i) => {
            functionScope.add(new VariableDefinition(name, args[i]));
        });
        return evaluate(definition.definition.value, functionScope.createScope());
    }
    return definition.definition.fn(...args);
};

const evaluateMatch = (expression: MatchExpression, scope: Scope): Type => {
    let type = evaluate(expression.of, scope);
    if (type.type === 'never') return NeverType.instance;

    const withBinding = (arm: MatchArm, armType: Type): Scope => {
        if (arm.binding === undefined) return scope;

        const armScope = new ScopeBuilder(`match arm`, scope);
        armScope.add(new VariableDefinition(arm.binding, armType));
        return armScope.createScope();
    };

    const matchTypes: Type[] = [];
    for (const arm of expression.arms) {
        const armType = evaluate(arm.pattern, scope);
        const t = intersect(armType, type);
        if (t.type !== 'never') {
            matchTypes.push(evaluate(arm.to, withBinding(arm, t)));
            type = without(type, armType);
        }
    }

    return union(...matchTypes);
};

const evaluateScope = (expression: ScopeExpression, parentScope: Scope): Type => {
    let name = 'scope expression';
    if (expression.source) {
        const { document, span } = expression.source;
        name += ` at ${document.name}:${span[0]}`;
    }

    const scope = new ScopeBuilder(name, parentScope);
    for (const def of expression.definitions) {
        scope.add(def);
    }

    return evaluate(expression.expression, scope.createScope());
};

/**
 * Evaluates the given expression. If a type is given, then the type will be returned as is.
 *
 * @throws {@link EvaluationError}
 */
export const evaluate = (expression: Expression, scope: Scope): Type => {
    if (expression.underlying !== 'expression') {
        // type
        return expression;
    }

    switch (expression.type) {
        case 'named':
            return evaluateNamed(expression, scope);
        case 'union':
            return union(...expression.items.map((e) => evaluate(e, scope)));
        case 'intersection':
            return intersect(...expression.items.map((e) => evaluate(e, scope)));
        case 'field-access':
            return evaluateFieldAccess(expression, scope);
        case 'builtin-function':
            return evaluateFunctionCall(expression, scope);
        case 'match':
            return evaluateMatch(expression, scope);
        case 'scope':
            return evaluateScope(expression, scope);
        default:
            return assertNever(expression);
    }
};
