/* eslint-disable max-classes-per-file */
import { NodeSchema } from '../common-types';
import { evaluate } from './evaluate';
import { Expression } from './expression';
import { intersect } from './intersection';
import { fromJson } from './json';
import { TypeDefinitions } from './typedef';
import { Type } from './types';
import { getReferences } from './util';

const getParamName = (inputId: number) => `Input${inputId}`;

const evaluateInputOutput = (
    schema: NodeSchema,
    type: 'input' | 'output',
    definitions: TypeDefinitions,
    genericParameters?: ReadonlyMap<string, Type>
): Map<number, Type> => {
    const result = new Map<number, Type>();
    for (const i of schema[`${type}s`]) {
        try {
            result.set(i.id, evaluate(fromJson(i.type), definitions, genericParameters));
        } catch (error) {
            throw new Error(
                `Unable to evaluate type of ${schema.name} (id: ${schema.schemaId}) > ${i.label} (id: ${i.id})` +
                    `: ${String(error)}`
            );
        }
    }
    return result;
};

const createGenericParametersFromInputs = (
    inputs: ReadonlyMap<number, Type>
): Map<string, Type> => {
    const parameters = new Map<string, Type>();
    for (const [id, type] of inputs) {
        parameters.set(getParamName(id), type);
    }
    return parameters;
};

export class FunctionDefinition {
    readonly inputs: ReadonlyMap<number, Type>;

    readonly outputDefaults: ReadonlyMap<number, Type>;

    readonly outputExpressions: ReadonlyMap<number, Expression>;

    readonly genericOutputs: ReadonlySet<number>;

    get isGeneric() {
        return this.genericOutputs.size > 0;
    }

    readonly typeDefinitions: TypeDefinitions;

    readonly inputDataLiterals: Set<number>;

    readonly defaultInstance: FunctionInstance;

    private constructor(schema: NodeSchema, definitions: TypeDefinitions) {
        this.typeDefinitions = definitions;

        this.inputs = evaluateInputOutput(schema, 'input', definitions);
        this.outputDefaults = evaluateInputOutput(
            schema,
            'output',
            definitions,
            createGenericParametersFromInputs(this.inputs)
        );
        this.outputExpressions = new Map(schema.outputs.map((o) => [o.id, fromJson(o.type)]));

        const genericParameters = new Set([...this.inputs.keys()].map(getParamName));
        this.genericOutputs = new Set(
            [...this.outputExpressions]
                .filter(([, expression]) => {
                    for (const name of getReferences(expression)) {
                        if (genericParameters.has(name)) {
                            return true;
                        }
                    }
                    return false;
                })
                .map(([id]) => id)
        );

        this.inputDataLiterals = new Set(
            schema.inputs
                .filter((i) => {
                    return (
                        i.kind === 'number' ||
                        i.kind === 'slider' ||
                        i.kind === 'text' ||
                        i.kind === 'text-line'
                    );
                })
                .map((i) => i.id)
        );

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.defaultInstance = FunctionInstance.fromDefinition(this);
    }

    static fromSchema(schema: NodeSchema, definitions: TypeDefinitions): FunctionDefinition {
        return new FunctionDefinition(schema, definitions);
    }
}

export class FunctionInstance {
    readonly definition: FunctionDefinition;

    readonly inputs: ReadonlyMap<number, Type>;

    readonly outputs: ReadonlyMap<number, Type>;

    private constructor(
        definition: FunctionDefinition,
        inputs: ReadonlyMap<number, Type>,
        outputs: ReadonlyMap<number, Type>
    ) {
        this.definition = definition;
        this.inputs = inputs;
        this.outputs = outputs;
    }

    static fromDefinition(definition: FunctionDefinition): FunctionInstance {
        return new FunctionInstance(definition, definition.inputs, definition.outputDefaults);
    }

    static fromPartialInputs(
        definition: FunctionDefinition,
        partialInputs: ReadonlyMap<number, Type> | ((inputId: number) => Type | undefined)
    ): FunctionInstance {
        if (typeof partialInputs === 'object') {
            if (partialInputs.size === 0) return definition.defaultInstance;
            const map = partialInputs;
            // eslint-disable-next-line no-param-reassign
            partialInputs = (id) => map.get(id);
        }

        const newInputs = new Map<number, Type>();
        for (const [id, definitionType] of definition.inputs) {
            const assignedType = partialInputs(id);

            if (!assignedType) {
                newInputs.set(id, definitionType);
            } else {
                newInputs.set(id, intersect(assignedType, definitionType));
            }
        }

        // we don't need to evaluate the outputs of if they aren't generic
        if (!definition.isGeneric) {
            return new FunctionInstance(definition, newInputs, definition.outputDefaults);
        }

        // evaluate generic outputs
        const genericParameters = new Map<string, Type>();
        for (const [id, type] of newInputs) {
            genericParameters.set(getParamName(id), type);
        }

        const newOutputs = new Map<number, Type>();
        for (const [id, expression] of definition.outputExpressions) {
            if (definition.genericOutputs.has(id)) {
                newOutputs.set(
                    id,
                    evaluate(expression, definition.typeDefinitions, genericParameters)
                );
            } else {
                newOutputs.set(id, definition.outputDefaults.get(id)!);
            }
        }

        return new FunctionInstance(definition, newInputs, newOutputs);
    }

    canAssign(inputId: number, type: Type): boolean {
        const iType = this.inputs.get(inputId);
        if (!iType) throw new Error(`Invalid input id ${inputId}`);

        // we say that types A is assignable to type B if they are not disjoint
        const overlap = intersect(type, iType);

        return overlap.type !== 'never';
    }
}
