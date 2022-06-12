/* eslint-disable max-classes-per-file */
import { NodeSchema } from '../common-types';
import { evaluate } from './evaluate';
import { Expression } from './expression';
import { intersect } from './intersection';
import { fromJson } from './json';
import { isSubsetOf } from './relation';
import { TypeDefinitions } from './typedef';
import { StructType, Type } from './types';
import { getReferences, isSameType } from './util';

const Null = new StructType('null');

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

    private constructor(
        inputs: ReadonlyMap<number, Type>,
        outputDefaults: ReadonlyMap<number, Type>,
        outputExpressions: ReadonlyMap<number, Expression>,
        definitions: TypeDefinitions
    ) {
        this.typeDefinitions = definitions;

        this.inputs = inputs;
        this.outputExpressions = outputExpressions;
        this.outputDefaults = outputDefaults;

        const genericParameters = new Set([...inputs.keys()].map(getParamName));
        this.genericOutputs = new Set(
            [...outputExpressions]
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
    }

    static fromSchema(schema: NodeSchema, definitions: TypeDefinitions): FunctionDefinition {
        const inputs = evaluateInputOutput(schema, 'input', definitions);
        const outputDefaults = evaluateInputOutput(
            schema,
            'output',
            definitions,
            createGenericParametersFromInputs(inputs)
        );
        const outputExpressions = new Map(schema.outputs.map((o) => [o.id, fromJson(o.type)]));

        return new FunctionDefinition(inputs, outputDefaults, outputExpressions, definitions);
    }

    instantiate(): FunctionInstance {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return new FunctionInstance(this, this.inputs, this.outputDefaults);
    }
}

export class FunctionInstance {
    readonly definition: FunctionDefinition;

    readonly inputs: ReadonlyMap<number, Type>;

    readonly outputs: ReadonlyMap<number, Type>;

    constructor(
        definition: FunctionDefinition,
        inputs: ReadonlyMap<number, Type>,
        outputs: ReadonlyMap<number, Type>
    ) {
        this.definition = definition;

        this.inputs = inputs;
        this.outputs = outputs;
    }

    evaluate(): void {
        const parameters = new Map<string, Type>();
        for (const [id, type] of this.inputs) {
            parameters.set(getParamName(id), type);
        }
    }

    canAssign(inputId: number, type: Type): boolean {
        const iType = this.inputs.get(inputId);
        if (!iType) throw new Error(`Invalid input id ${inputId}`);

        // we say that types A is assignable to type B if they are not disjoint
        const overlap = intersect(type, iType);

        return !isSubsetOf(overlap, Null);
    }

    withInputs(partialInputs: ReadonlyMap<number, Type>): FunctionInstance {
        if (partialInputs.size === 0) return this.definition.instantiate();

        const newInputs = new Map<number, Type>();
        for (const [id, definitionType] of this.definition.inputs) {
            const assignedType = partialInputs.get(id);

            if (!assignedType) {
                newInputs.set(id, definitionType);
            } else {
                newInputs.set(id, intersect(assignedType, definitionType));
            }
        }

        // we don't need to evaluate the outputs of if they aren't generic
        if (!this.definition.isGeneric) {
            return new FunctionInstance(this.definition, newInputs, this.definition.outputDefaults);
        }

        // if the new inputs are the same as the current inputs, we can just reuse this instance
        let isDifferent = false;
        for (const [id, newType] of newInputs) {
            if (!isSameType(newType, this.inputs.get(id)!)) {
                isDifferent = true;
                break;
            }
        }
        if (!isDifferent) return this;

        // evaluate generic outputs
        const genericParameters = new Map<string, Type>();
        for (const [id, type] of newInputs) {
            genericParameters.set(getParamName(id), type);
        }

        const newOutputs = new Map<number, Type>();
        for (const [id, expression] of this.definition.outputExpressions) {
            if (this.definition.genericOutputs.has(id)) {
                newOutputs.set(
                    id,
                    evaluate(expression, this.definition.typeDefinitions, genericParameters)
                );
            } else {
                newOutputs.set(id, this.definition.outputDefaults.get(id)!);
            }
        }

        return new FunctionInstance(this.definition, newInputs, newOutputs);
    }
}
