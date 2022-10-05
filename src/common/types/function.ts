import {
    Expression,
    NonNeverType,
    ParameterDefinition,
    Scope,
    ScopeBuilder,
    Type,
    evaluate,
    getReferences,
    intersect,
    isDisjointWith,
} from '@chainner/navi';
import { Input, InputId, InputSchemaValue, NodeSchema, Output, OutputId } from '../common-types';
import { EMPTY_MAP, lazy, topologicalSort } from '../util';
import { getChainnerScope } from './chainner-scope';
import { fromJson } from './json';

const getConversionScope = lazy(() => {
    const scope = new ScopeBuilder('Conversion scope', getChainnerScope());
    scope.add(new ParameterDefinition('Input'));
    return scope.createScope();
});

type IdType<P extends 'Input' | 'Output'> = P extends 'Input' ? InputId : OutputId;
const getParamRefs = <P extends 'Input' | 'Output'>(
    expression: Expression,
    param: P,
    valid: ReadonlySet<IdType<P>>
): Set<IdType<P>> => {
    const refs = new Set<IdType<P>>();
    for (const ref of getReferences(expression)) {
        if (ref.startsWith(param)) {
            const rest = ref.slice(param.length);
            if (/^\d+$/.test(rest)) {
                const id = Number(rest) as IdType<P>;
                if (valid.has(id)) {
                    refs.add(id);
                }
            }
        }
    }
    return refs;
};

const getInputParamName = (inputId: InputId) => `Input${inputId}` as const;
const getOutputParamName = (outputId: OutputId) => `Output${outputId}` as const;

interface InputInfo {
    expression: Expression;
    inputRefs: Set<InputId>;
    input: Input;
}
const evaluateInputs = (
    schema: NodeSchema,
    scope: Scope
): { ordered: InputInfo[]; defaults: Map<InputId, NonNeverType> } => {
    const inputIds = new Set(schema.inputs.map((i) => i.id));

    const infos = new Map<InputId, InputInfo>();
    for (const input of schema.inputs) {
        try {
            const expression = fromJson(input.type);
            infos.set(input.id, {
                expression,
                inputRefs: getParamRefs(expression, 'Input', inputIds),
                input,
            });
        } catch (error) {
            const name = `${schema.name} (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})`;
            throw new Error(
                `Unable to parse input type of ${name}:\n` +
                    `JSON: ${JSON.stringify(input.type)}\n` +
                    `${String(error)}`
            );
        }
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

    const expressionScopeBuilder = new ScopeBuilder('evaluateInputs scope', scope);
    for (const inputId of inputIds) {
        expressionScopeBuilder.add(new ParameterDefinition(getInputParamName(inputId)));
    }
    const expressionScope = expressionScopeBuilder.createScope();

    const defaults = new Map<InputId, NonNeverType>();
    for (const { expression, input } of ordered) {
        const name = `${schema.name} (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})`;

        let type: Type;
        try {
            type = evaluate(expression, expressionScope);
        } catch (error) {
            throw new Error(`Unable to evaluate input type of ${name}: ${String(error)}`);
        }
        if (type.type === 'never') {
            throw new Error(`The input type of ${name} is always 'never'. This is a bug.`);
        }

        defaults.set(input.id, type);
        expressionScope.assignParameter(getInputParamName(input.id), type);
    }

    return { ordered, defaults };
};

interface OutputInfo {
    expression: Expression;
    inputRefs: Set<InputId>;
    outputRefs: Set<OutputId>;
    output: Output;
}
const evaluateOutputs = (
    schema: NodeSchema,
    scope: Scope,
    inputDefaults: ReadonlyMap<InputId, NonNeverType>
): { ordered: OutputInfo[]; defaults: Map<OutputId, NonNeverType> } => {
    const inputIds = new Set(inputDefaults.keys());
    const outputIds = new Set(schema.outputs.map((i) => i.id));

    const infos = new Map<OutputId, OutputInfo>();
    for (const output of schema.outputs) {
        try {
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
        } catch (error) {
            const name = `${schema.name} (id: ${schema.schemaId}) > ${output.label} (id: ${output.id})`;
            throw new Error(
                `Unable to parse input type of ${name}:\n` +
                    `JSON: ${JSON.stringify(output.type)}\n` +
                    `${String(error)}`
            );
        }
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

    const expressionScopeBuilder = new ScopeBuilder('evaluateOutputs scope', scope);
    for (const [inputId, inputType] of inputDefaults) {
        expressionScopeBuilder.add(new ParameterDefinition(getInputParamName(inputId), inputType));
    }
    for (const outputId of outputIds) {
        expressionScopeBuilder.add(new ParameterDefinition(getOutputParamName(outputId)));
    }
    const expressionScope = expressionScopeBuilder.createScope();

    const defaults = new Map<OutputId, NonNeverType>();
    for (const { expression, output } of ordered) {
        const name = `${schema.name} (id: ${schema.schemaId}) > ${output.label} (id: ${output.id})`;

        let type: Type;
        try {
            type = evaluate(expression, expressionScope);
        } catch (error) {
            throw new Error(`Unable to evaluate output type of ${name}: ${String(error)}`);
        }
        if (type.type === 'never') {
            throw new Error(`The input type of ${name} is always 'never'. This is a bug.`);
        }

        defaults.set(output.id, type);
        expressionScope.assignParameter(getOutputParamName(output.id), type);
    }
    return { ordered, defaults };
};

const evaluateInputOptions = (
    schema: NodeSchema,
    scope: Scope
): Map<InputId, Map<InputSchemaValue, NonNeverType>> => {
    const result = new Map<InputId, Map<InputSchemaValue, NonNeverType>>();
    for (const input of schema.inputs) {
        if (input.kind === 'dropdown' && input.options) {
            const options = new Map<InputSchemaValue, NonNeverType>();
            result.set(input.id, options);
            for (const o of input.options) {
                if (o.type !== undefined) {
                    const name =
                        `${o.option}=${JSON.stringify(o.value)} ` +
                        `in (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})`;

                    let type;
                    try {
                        type = evaluate(fromJson(o.type), scope);
                    } catch (error) {
                        throw new Error(
                            `Unable to evaluate type of option ${name}: ${String(error)}`
                        );
                    }
                    if (type.type === 'never') {
                        throw new Error(`Type of ${name} cannot be 'never'.`);
                    }

                    options.set(o.value, type);
                }
            }
        }
    }
    return result;
};

const getConversions = (schema: NodeSchema): Map<InputId, Expression> => {
    const result = new Map<InputId, Expression>();
    for (const input of schema.inputs) {
        // eslint-disable-next-line no-continue
        if (!input.conversion) continue;

        const e = fromJson(input.conversion);

        // verify that it's a valid conversion
        try {
            evaluate(e, getConversionScope());
        } catch (error) {
            const name = `${schema.name} (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})`;
            throw new Error(`The conversion of input ${name} is invalid: ${String(error)}`);
        }

        result.set(input.id, e);
    }
    return result;
};

export class FunctionDefinition {
    readonly schema: NodeSchema;

    readonly scope: Scope;

    readonly inputDefaults: ReadonlyMap<InputId, NonNeverType>;

    readonly inputExpressions: ReadonlyMap<InputId, Expression>;

    readonly inputGenerics: ReadonlySet<InputId>;

    readonly inputEvaluationOrder: readonly InputId[];

    readonly inputConversions: ReadonlyMap<InputId, Expression>;

    readonly outputDefaults: ReadonlyMap<OutputId, NonNeverType>;

    readonly outputExpressions: ReadonlyMap<OutputId, Expression>;

    readonly outputGenerics: ReadonlySet<OutputId>;

    readonly outputEvaluationOrder: readonly OutputId[];

    get isGeneric() {
        return this.inputGenerics.size > 0 || this.outputGenerics.size > 0;
    }

    readonly inputDataLiterals: Set<InputId>;

    readonly inputNullable: Set<InputId>;

    readonly inputOptions: ReadonlyMap<InputId, ReadonlyMap<string | number, NonNeverType>>;

    readonly defaultInstance: FunctionInstance;

    private constructor(schema: NodeSchema, scope: Scope) {
        this.schema = schema;
        this.scope = scope;

        // inputs
        const inputs = evaluateInputs(schema, scope);
        this.inputDefaults = inputs.defaults;
        this.inputExpressions = new Map(
            inputs.ordered.map(({ expression, input }) => [input.id, expression])
        );
        this.inputGenerics = new Set(
            inputs.ordered.filter((i) => i.inputRefs.size > 0).map(({ input }) => input.id)
        );
        this.inputEvaluationOrder = inputs.ordered.map(({ input }) => input.id);
        this.inputConversions = getConversions(schema);

        // outputs
        const outputs = evaluateOutputs(schema, scope, this.inputDefaults);
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
        this.inputOptions = evaluateInputOptions(schema, scope);

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.defaultInstance = FunctionInstance.fromDefinition(this);
    }

    static fromSchema(schema: NodeSchema, scope: Scope): FunctionDefinition {
        return new FunctionDefinition(schema, scope);
    }

    convertInput(inputId: InputId, type: Type): Type {
        const conversion = this.inputConversions.get(inputId);
        if (!conversion) {
            return type;
        }

        const scope = getConversionScope();
        scope.assignParameter('Input', type);
        return evaluate(conversion, scope);
    }

    canAssignInput(inputId: InputId, type: Type): boolean {
        const inputType = this.inputDefaults.get(inputId);
        if (!inputType) {
            throw new Error('Invalid input id');
        }
        return !isDisjointWith(inputType, this.convertInput(inputId, type));
    }

    canAssignOutput(outputId: OutputId, type: Type): boolean {
        const outputType = this.outputDefaults.get(outputId);
        if (!outputType) {
            throw new Error('Invalid output id');
        }
        return !isDisjointWith(outputType, type);
    }
}

export interface FunctionInputAssignmentError {
    inputId: InputId;
    inputType: NonNeverType;
    assignedType: NonNeverType;
}
export interface FunctionOutputError {
    outputId: OutputId;
}
export class FunctionInstance {
    readonly definition: FunctionDefinition;

    readonly inputs: ReadonlyMap<InputId, NonNeverType>;

    readonly outputs: ReadonlyMap<OutputId, NonNeverType>;

    readonly inputErrors: readonly FunctionInputAssignmentError[];

    readonly outputErrors: readonly FunctionOutputError[];

    private constructor(
        definition: FunctionDefinition,
        inputs: ReadonlyMap<InputId, NonNeverType>,
        outputs: ReadonlyMap<OutputId, NonNeverType>,
        inputErrors: readonly FunctionInputAssignmentError[],
        outputErrors: readonly FunctionOutputError[]
    ) {
        this.definition = definition;
        this.inputs = inputs;
        this.outputs = outputs;
        this.inputErrors = inputErrors;
        this.outputErrors = outputErrors;
    }

    static fromDefinition(definition: FunctionDefinition): FunctionInstance {
        return new FunctionInstance(
            definition,
            definition.inputDefaults,
            definition.outputDefaults,
            [],
            []
        );
    }

    static fromPartialInputs(
        definition: FunctionDefinition,
        partialInputs:
            | ReadonlyMap<InputId, NonNeverType>
            | ((inputId: InputId) => NonNeverType | undefined),
        outputNarrowing: ReadonlyMap<OutputId, Type> = EMPTY_MAP
    ): FunctionInstance {
        if (typeof partialInputs === 'object') {
            if (partialInputs.size === 0) return definition.defaultInstance;
            const map = partialInputs;
            // eslint-disable-next-line no-param-reassign
            partialInputs = (id) => map.get(id);
        }

        const inputErrors: FunctionInputAssignmentError[] = [];
        const outputErrors: FunctionOutputError[] = [];

        // scope
        const scopeBuilder = new ScopeBuilder('function instance', definition.scope);
        for (const [inputId, type] of definition.inputDefaults) {
            scopeBuilder.add(new ParameterDefinition(getInputParamName(inputId), type));
        }
        for (const [outputId, type] of definition.outputDefaults) {
            scopeBuilder.add(new ParameterDefinition(getOutputParamName(outputId), type));
        }
        const scope = scopeBuilder.createScope();

        // evaluate inputs
        const inputs = new Map<InputId, NonNeverType>();
        for (const id of definition.inputEvaluationOrder) {
            let type: Type;
            if (definition.inputGenerics.has(id)) {
                type = evaluate(definition.inputExpressions.get(id)!, scope);
            } else {
                type = definition.inputDefaults.get(id)!;
            }

            if (type.type !== 'never') {
                const assignedType = partialInputs(id);
                if (assignedType) {
                    const converted = definition.convertInput(id, assignedType);
                    const newType = intersect(converted, type);
                    if (newType.type === 'never') {
                        inputErrors.push({ inputId: id, inputType: type, assignedType });
                    }
                    type = newType;
                }
            }

            if (type.type === 'never') {
                // If the output type is never, then there is some error with the input.
                // However, we don't have the means to communicate this error yet, so we'll just
                // ignore it for now.
                type = definition.inputDefaults.get(id)!;
            }

            inputs.set(id, type);
            scope.assignParameter(getInputParamName(id), type);
        }

        // we don't need to evaluate the outputs of if they aren't generic
        if (definition.outputGenerics.size === 0 && outputNarrowing.size === 0) {
            return new FunctionInstance(
                definition,
                inputs,
                definition.outputDefaults,
                inputErrors,
                outputErrors
            );
        }

        // evaluate outputs
        const outputs = new Map<OutputId, NonNeverType>();
        for (const id of definition.outputEvaluationOrder) {
            let type: Type;
            if (definition.outputGenerics.has(id)) {
                type = evaluate(definition.outputExpressions.get(id)!, scope);
                if (type.type === 'never') {
                    outputErrors.push({ outputId: id });
                }
            } else {
                type = definition.outputDefaults.get(id)!;
            }

            const narrowing = outputNarrowing.get(id);
            if (narrowing) {
                type = intersect(narrowing, type);
            }

            if (type.type === 'never') {
                // If the output type is never, then there is some error with the input.
                // However, we don't have the means to communicate this error yet, so we'll just
                // ignore it for now.
                type = definition.outputDefaults.get(id)!;
            }

            outputs.set(id, type);
            scope.assignParameter(getOutputParamName(id), type);
        }

        return new FunctionInstance(definition, inputs, outputs, inputErrors, outputErrors);
    }

    canAssign(inputId: InputId, type: Type): boolean {
        const iType = this.definition.inputDefaults.get(inputId);
        if (!iType) throw new Error(`Invalid input id ${inputId}`);

        // we say that types A is assignable to type B if they are not disjoint
        return !isDisjointWith(iType, this.definition.convertInput(inputId, type));
    }
}
