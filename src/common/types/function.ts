/* eslint-disable max-classes-per-file */
import { Input, InputSchemaValue, NodeSchema, Output } from '../common-types';
import { EMPTY_MAP, topologicalSort } from '../util';
import { evaluate } from './evaluate';
import { Expression } from './expression';
import { intersect } from './intersection';
import { fromJson } from './json';
import { TypeDefinitions } from './typedef';
import { Type } from './types';
import { getReferences } from './util';

const getParamRefs = (
    expression: Expression,
    param: 'Input' | 'Output',
    valid: ReadonlySet<number>
): Set<number> => {
    const refs = new Set<number>();
    for (const ref of getReferences(expression)) {
        if (ref.startsWith(param)) {
            const rest = ref.slice(param.length);
            if (/^\d+$/.test(rest)) {
                const id = Number(rest);
                if (valid.has(id)) {
                    refs.add(id);
                }
            }
        }
    }
    return refs;
};

const getInputParamName = (inputId: number) => `Input${inputId}` as const;
const getOutputParamName = (outputId: number) => `Output${outputId}` as const;

const createGenericParametersFromInputs = (
    inputs: ReadonlyMap<number, Type>
): Map<string, Type> => {
    const parameters = new Map<string, Type>();
    for (const [id, type] of inputs) {
        parameters.set(getInputParamName(id), type);
    }
    return parameters;
};

interface InputInfo {
    expression: Expression;
    inputRefs: Set<number>;
    input: Input;
}
const evaluateInputs = (
    schema: NodeSchema,
    definitions: TypeDefinitions
): { ordered: InputInfo[]; defaults: Map<number, Type> } => {
    const inputIds = new Set(schema.inputs.map((i) => i.id));

    const infos = new Map<number, InputInfo>();
    for (const input of schema.inputs) {
        const expression = fromJson(input.type);
        infos.set(input.id, {
            expression,
            inputRefs: getParamRefs(expression, 'Input', inputIds),
            input,
        });
    }

    const ordered = topologicalSort(infos.values(), (node) =>
        [...node.inputRefs].map((ref) => infos.get(ref)!)
    );
    if (!ordered) {
        throw new Error(
            `The types of the inputs of ${schema.name} (id: ${schema.schemaId}) has a cyclic dependency.` +
                ` Carefully review the uses for 'Input*' variables in the input types of that node.`
        );
    }
    ordered.reverse();

    const defaults = new Map<number, Type>();
    const genericParameters = new Map<string, Type>();
    for (const { expression, input } of ordered) {
        try {
            const type = evaluate(expression, definitions, genericParameters);
            defaults.set(input.id, type);
            genericParameters.set(getInputParamName(input.id), type);
        } catch (error) {
            throw new Error(
                `Unable to evaluate input type of ${schema.name} (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})` +
                    `: ${String(error)}`
            );
        }
    }

    return { ordered, defaults };
};

interface OutputInfo {
    expression: Expression;
    inputRefs: Set<number>;
    outputRefs: Set<number>;
    output: Output;
}
const evaluateOutputs = (
    schema: NodeSchema,
    definitions: TypeDefinitions,
    inputDefaults: ReadonlyMap<number, Type>
): { ordered: OutputInfo[]; defaults: Map<number, Type> } => {
    const inputIds = new Set(inputDefaults.keys());
    const outputIds = new Set(schema.outputs.map((i) => i.id));

    const infos = new Map<number, OutputInfo>();
    for (const output of schema.outputs) {
        const expression = fromJson(output.type);
        infos.set(output.id, {
            expression,
            // Collecting input references isn't necessary for the evaluation, but they will be
            // needed by `FunctionDefinition`'s constructor, so we collect them here while we're
            // at it.
            inputRefs: getParamRefs(expression, 'Input', inputIds),
            outputRefs: getParamRefs(expression, 'Output', outputIds),
            output,
        });
    }

    const ordered = topologicalSort(infos.values(), (node) =>
        [...node.outputRefs].map((ref) => infos.get(ref)!)
    );
    if (!ordered) {
        throw new Error(
            `The types of the output of ${schema.name} (id: ${schema.schemaId}) has a cyclic dependency.` +
                ` Carefully review the uses for 'Output*' variables in that node.`
        );
    }
    ordered.reverse();

    const defaults = new Map<number, Type>();
    const genericParameters = createGenericParametersFromInputs(inputDefaults);
    for (const { expression, output } of ordered) {
        try {
            const type = evaluate(expression, definitions, genericParameters);
            defaults.set(output.id, type);
            genericParameters.set(getOutputParamName(output.id), type);
        } catch (error) {
            throw new Error(
                `Unable to evaluate output type of ${schema.name} (id: ${schema.schemaId}) > ${output.label} (id: ${output.id})` +
                    `: ${String(error)}`
            );
        }
    }
    return { ordered, defaults };
};

const evaluateInputOptions = (
    schema: NodeSchema,
    definitions: TypeDefinitions,
    genericParameters?: ReadonlyMap<string, Type>
): Map<number, Map<InputSchemaValue, Type>> => {
    const result = new Map<number, Map<InputSchemaValue, Type>>();
    for (const input of schema.inputs) {
        if (input.kind === 'dropdown' && input.options) {
            const options = new Map<InputSchemaValue, Type>();
            result.set(input.id, options);
            for (const o of input.options) {
                if (o.type !== undefined) {
                    let type;
                    try {
                        type = evaluate(fromJson(o.type), definitions, genericParameters);
                    } catch (error) {
                        throw new Error(
                            `Unable to evaluate type of option ` +
                                `${o.option}=${JSON.stringify(o.value)} ` +
                                `in (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})` +
                                `: ${String(error)}`
                        );
                    }
                    options.set(o.value, type);
                }
            }
        }
    }
    return result;
};

export class FunctionDefinition {
    readonly inputDefaults: ReadonlyMap<number, Type>;

    readonly inputExpressions: ReadonlyMap<number, Expression>;

    readonly inputGenerics: ReadonlySet<number>;

    readonly inputEvaluationOrder: readonly number[];

    readonly outputDefaults: ReadonlyMap<number, Type>;

    readonly outputExpressions: ReadonlyMap<number, Expression>;

    readonly outputGenerics: ReadonlySet<number>;

    readonly outputEvaluationOrder: readonly number[];

    get isGeneric() {
        return this.inputGenerics.size > 0 || this.outputGenerics.size > 0;
    }

    readonly typeDefinitions: TypeDefinitions;

    readonly inputDataLiterals: Set<number>;

    readonly inputNullable: Set<number>;

    readonly inputOptions: ReadonlyMap<number, ReadonlyMap<string | number, Type>>;

    readonly defaultInstance: FunctionInstance;

    private constructor(schema: NodeSchema, definitions: TypeDefinitions) {
        this.typeDefinitions = definitions;

        // inputs
        const inputs = evaluateInputs(schema, definitions);
        this.inputDefaults = inputs.defaults;
        this.inputExpressions = new Map(
            inputs.ordered.map(({ expression, input }) => [input.id, expression])
        );
        this.inputGenerics = new Set(
            inputs.ordered.filter((i) => i.inputRefs.size > 0).map(({ input }) => input.id)
        );
        this.inputEvaluationOrder = inputs.ordered.map(({ input }) => input.id);

        // outputs
        const outputs = evaluateOutputs(schema, definitions, this.inputDefaults);
        this.outputDefaults = outputs.defaults;
        this.outputExpressions = new Map(
            outputs.ordered.map(({ expression, output }) => [output.id, expression])
        );
        this.outputGenerics = new Set(
            outputs.ordered
                .filter((i) => i.inputRefs.size > 0 || i.outputRefs.size > 0)
                .map(({ output }) => output.id)
        );
        this.outputEvaluationOrder = outputs.ordered.map(({ output }) => output.id);

        // input literal values
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
        this.inputNullable = new Set(schema.inputs.filter((i) => i.optional).map((i) => i.id));
        this.inputOptions = evaluateInputOptions(schema, definitions);

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
        return new FunctionInstance(
            definition,
            definition.inputDefaults,
            definition.outputDefaults
        );
    }

    static fromPartialInputs(
        definition: FunctionDefinition,
        partialInputs: ReadonlyMap<number, Type> | ((inputId: number) => Type | undefined),
        neverIsDefault: boolean,
        outputNarrowing: ReadonlyMap<number, Type> = EMPTY_MAP
    ): FunctionInstance {
        if (typeof partialInputs === 'object') {
            if (partialInputs.size === 0) return definition.defaultInstance;
            const map = partialInputs;
            // eslint-disable-next-line no-param-reassign
            partialInputs = (id) => map.get(id);
        }

        // evaluate inputs
        const inputs = new Map<number, Type>();
        const genericParameters = new Map<string, Type>();
        for (const id of definition.inputEvaluationOrder) {
            let type: Type;
            if (definition.inputGenerics.has(id)) {
                type = evaluate(
                    definition.inputExpressions.get(id)!,
                    definition.typeDefinitions,
                    genericParameters
                );
            } else {
                type = definition.inputDefaults.get(id)!;
            }

            const assignedType = partialInputs(id);
            if (assignedType) {
                type = intersect(assignedType, type);
            }

            if (neverIsDefault && type.type === 'never') {
                // If the output type is never, then there is some error with the input.
                // However, we don't have the means to communicate this error yet, so we'll just
                // ignore it for now.
                type = definition.inputDefaults.get(id)!;
            }

            inputs.set(id, type);
            genericParameters.set(getInputParamName(id), type);
        }

        // we don't need to evaluate the outputs of if they aren't generic
        if (definition.outputGenerics.size === 0 && outputNarrowing.size === 0) {
            return new FunctionInstance(definition, inputs, definition.outputDefaults);
        }

        // evaluate outputs
        const outputs = new Map<number, Type>();
        for (const id of definition.outputEvaluationOrder) {
            let type: Type;
            if (definition.outputGenerics.has(id)) {
                type = evaluate(
                    definition.outputExpressions.get(id)!,
                    definition.typeDefinitions,
                    genericParameters
                );
            } else {
                type = definition.outputDefaults.get(id)!;
            }

            const narrowing = outputNarrowing.get(id);
            if (narrowing) {
                type = intersect(narrowing, type);
            }

            if (neverIsDefault && type.type === 'never') {
                // If the output type is never, then there is some error with the input.
                // However, we don't have the means to communicate this error yet, so we'll just
                // ignore it for now.
                type = definition.outputDefaults.get(id)!;
            }

            outputs.set(id, type);
            genericParameters.set(getOutputParamName(id), type);
        }

        return new FunctionInstance(definition, inputs, outputs);
    }

    canAssign(inputId: number, type: Type): boolean {
        const iType = this.definition.inputDefaults.get(inputId);
        if (!iType) throw new Error(`Invalid input id ${inputId}`);

        // we say that types A is assignable to type B if they are not disjoint
        const overlap = intersect(type, iType);

        return overlap.type !== 'never';
    }
}
