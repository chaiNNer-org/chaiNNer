import {
    Expression,
    NeverType,
    NonNeverType,
    NumberType,
    ParameterDefinition,
    Scope,
    ScopeBuilder,
    StringType,
    Type,
    evaluate,
    getReferences,
    intersect,
    literal,
    union,
    without,
} from '@chainner/navi';
import {
    Input,
    InputId,
    InputSchemaValue,
    IterInputId,
    IterOutputId,
    IteratorInputInfo,
    IteratorOutputInfo,
    NodeSchema,
    Output,
    OutputId,
} from '../common-types';
import { EMPTY_MAP, assertNever, isNotNullish, lazyKeyed, topologicalSort } from '../util';
import { assign, assignOk } from './assign';
import { ExpressionJson, fromJson } from './json';
import { splitOutputTypeAndError, withoutError } from './util';
import type { PassthroughInfo } from '../PassthroughMap';

const getConversionScope = lazyKeyed((parentScope: Scope) => {
    const scope = new ScopeBuilder('Conversion scope', parentScope);
    scope.add(new ParameterDefinition('Input'));
    return scope.createScope();
});

type GenericParam = 'Input' | 'Output' | 'IterInput' | 'IterOutput';
type ParamRef<P extends GenericParam = GenericParam> = `${P}${number}`;
const getParamRefs = <R extends ParamRef>(
    expression: Expression,
    valid: ReadonlySet<R>
): Set<R> => {
    const refs = new Set<R>();
    for (const ref of getReferences(expression)) {
        const paramRef = ref as R;
        if (valid.has(paramRef)) {
            refs.add(paramRef);
        }
    }
    return refs;
};

export const getInputParamName = (inputId: InputId) => `Input${inputId}` as const;
export const getIterInputParamName = (id: IterInputId) => `IterInput${id}` as const;
export const getOutputParamName = (outputId: OutputId) => `Output${outputId}` as const;
export const getIterOutputParamName = (id: IterOutputId) => `IterOutput${id}` as const;

interface BaseDesc<P extends GenericParam> {
    readonly type: P;
    /**
     * The type expression of the input/output.
     *
     * If `undefined`, then the expression is a constant. Use `default` instead.
     */
    readonly expression?: Expression;
    /**
     * The default type expression of the input/output.
     */
    readonly default: NonNeverType;
    /**
     * A label that uniquely identifies the input/output.
     *
     * This will be used in error messages, so it has to be human-readable.
     */
    readonly label: string;
    readonly param: ParamRef<P>;
    readonly references: Set<ParamRef>;
}
type Descriptor = InputDesc | IterInputDesc | OutputDesc | IterOutputDesc;
interface InputDesc extends BaseDesc<'Input'> {
    readonly input: Input;
}
interface IterInputDesc extends BaseDesc<'IterInput'> {
    readonly iterInput: IteratorInputInfo;
}
interface OutputDesc extends BaseDesc<'Output'> {
    readonly output: Output;
}
interface IterOutputDesc extends BaseDesc<'IterOutput'> {
    readonly iterOutput: IteratorOutputInfo;
}

type Intermediate<D extends Descriptor> = Omit<Required<D>, 'default'>;
const finalizeIntermediate = <D extends Descriptor>(
    desc: Intermediate<D>,
    defaultType: NonNeverType
): D => {
    return {
        ...desc,
        expression: desc.references.size === 0 ? undefined : desc.expression,
        default: defaultType,
    } as unknown as D;
};

const parseExpression = (expression: ExpressionJson, label: string): Expression => {
    try {
        return fromJson(expression);
    } catch (error) {
        throw new Error(
            `Unable to parse input type of ${label}:\n` +
                `JSON: ${JSON.stringify(expression)}\n` +
                `${String(error)}`
        );
    }
};

const evaluateInputs = (schema: NodeSchema, scope: Scope) => {
    const validRefs = new Set([
        ...schema.inputs.map(({ id }) => getInputParamName(id)),
        ...schema.iteratorInputs.map(({ id }) => getIterInputParamName(id)),
    ]);

    const unordered = new Map<ParamRef, Intermediate<InputDesc> | Intermediate<IterInputDesc>>();
    for (const input of schema.inputs) {
        const label = `${schema.name} (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})`;
        const param = getInputParamName(input.id);
        const expression = parseExpression(input.type, label);
        unordered.set(param, {
            type: 'Input',
            expression,
            label,
            param,
            references: getParamRefs(expression, validRefs),
            input,
        });
    }
    for (const iterInput of schema.iteratorInputs) {
        const label = `${schema.name} (id: ${schema.schemaId}) > Iterator Input ${iterInput.id}`;
        const expression = parseExpression(iterInput.sequenceType, label);
        const param = getIterInputParamName(iterInput.id);
        unordered.set(param, {
            type: 'IterInput',
            expression,
            label,
            param,
            references: getParamRefs(expression, validRefs),
            iterInput,
        });
    }

    const orderedInputs = topologicalSort(unordered.values(), (node) =>
        [...node.references].map((ref) => unordered.get(ref)!)
    );
    if (!orderedInputs) {
        throw new Error(
            `The types of the inputs of ${schema.name} (id: ${schema.schemaId}) has a cyclic dependency.` +
                ` Carefully review the uses for 'Input*' variables in the input types of that node.`
        );
    }
    orderedInputs.reverse();

    const expressionScopeBuilder = new ScopeBuilder('evaluateInputs scope', scope);
    for (const ref of validRefs) {
        expressionScopeBuilder.add(new ParameterDefinition(ref));
    }
    const expressionScope = expressionScopeBuilder.createScope();

    const ordered: (InputDesc | IterInputDesc)[] = [];
    const inputs: InputDesc[] = [];
    const iterInputs: IterInputDesc[] = [];
    for (const item of orderedInputs) {
        let type: Type;
        try {
            type = evaluate(item.expression, expressionScope);
        } catch (error) {
            throw new Error(`Unable to evaluate input type of ${item.label}: ${String(error)}`);
        }
        if (type.type === 'never') {
            throw new Error(
                `The input type of ${item.label} is always 'never'. This is a bug in the type.`
            );
        }

        let final;
        if (item.type === 'Input') {
            final = finalizeIntermediate(item, type);
            inputs.push(final);
        } else {
            final = finalizeIntermediate(item, type);
            iterInputs.push(final);
        }

        ordered.push(final);
        expressionScope.assignParameter(item.param, type);
    }

    return { ordered, inputs, iterInputs };
};

const evaluateOutputs = (
    schema: NodeSchema,
    scope: Scope,
    inputs: readonly (InputDesc | IterInputDesc)[]
) => {
    const validRefs = new Set([
        ...schema.inputs.map(({ id }) => getInputParamName(id)),
        ...schema.iteratorInputs.map(({ id }) => getIterInputParamName(id)),
        ...schema.outputs.map(({ id }) => getOutputParamName(id)),
        ...schema.iteratorOutputs.map(({ id }) => getIterOutputParamName(id)),
    ]);

    const unordered = new Map<ParamRef, Intermediate<OutputDesc> | Intermediate<IterOutputDesc>>();
    for (const output of schema.outputs) {
        const label = `${schema.name} (id: ${schema.schemaId}) > ${output.label} (id: ${output.id})`;
        const param = getOutputParamName(output.id);
        const expression = parseExpression(output.type, label);
        unordered.set(param, {
            type: 'Output',
            expression,
            label,
            param,
            references: getParamRefs(expression, validRefs),
            output,
        });
    }
    for (const iterOutput of schema.iteratorOutputs) {
        const label = `${schema.name} (id: ${schema.schemaId}) > Iterator output ${iterOutput.id}`;
        const param = getIterOutputParamName(iterOutput.id);
        const expression = parseExpression(iterOutput.sequenceType, label);
        unordered.set(param, {
            type: 'IterOutput',
            expression,
            label,
            param,
            references: getParamRefs(expression, validRefs),
            iterOutput,
        });
    }

    const orderedOutputs = topologicalSort(unordered.values(), (node) =>
        [...node.references].map((ref) => unordered.get(ref)).filter(isNotNullish)
    );
    if (!orderedOutputs) {
        throw new Error(
            `The types of the output of ${schema.name} (id: ${schema.schemaId}) has a cyclic dependency.` +
                ` Carefully review the uses for 'Output*' variables in that node.`
        );
    }
    orderedOutputs.reverse();

    const expressionScopeBuilder = new ScopeBuilder('evaluateOutputs scope', scope);
    for (const input of inputs) {
        expressionScopeBuilder.add(new ParameterDefinition(input.param, input.default));
    }
    for (const { id } of schema.outputs) {
        expressionScopeBuilder.add(new ParameterDefinition(getOutputParamName(id)));
    }
    for (const { id } of schema.iteratorOutputs) {
        expressionScopeBuilder.add(new ParameterDefinition(getIterOutputParamName(id)));
    }
    const expressionScope = expressionScopeBuilder.createScope();

    const ordered: (OutputDesc | IterOutputDesc)[] = [];
    const outputs: OutputDesc[] = [];
    const iterOutputs: IterOutputDesc[] = [];
    for (const item of orderedOutputs) {
        let type: Type;
        try {
            type = withoutError(evaluate(item.expression, expressionScope));
        } catch (error) {
            throw new Error(`Unable to evaluate output type of ${item.label}: ${String(error)}`);
        }
        if (type.type === 'never') {
            throw new Error(`The output type of ${item.label} is always 'never'. This is a bug.`);
        }

        let final;
        if (item.type === 'Output') {
            final = finalizeIntermediate(item, type);
            outputs.push(final);
        } else {
            final = finalizeIntermediate(item, type);
            iterOutputs.push(final);
        }

        ordered.push(final);
        expressionScope.assignParameter(item.param, type);
    }
    return { ordered, outputs, iterOutputs };
};

const getInputDataAdapters = (
    schema: NodeSchema,
    scope: Scope
): ReadonlyMap<InputId, (value: InputSchemaValue) => NonNeverType | undefined> => {
    const adapters = new Map<InputId, (value: InputSchemaValue) => NonNeverType | undefined>();

    for (const input of schema.inputs) {
        const inputName = `${schema.name} (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})`;

        if (input.adapt != null) {
            const adoptExpression = fromJson(input.adapt);
            const conversionScope = getConversionScope(scope);

            // verify that it's a valid conversion
            try {
                conversionScope.assignParameter(
                    'Input',
                    union(NumberType.instance, StringType.instance)
                );
                evaluate(adoptExpression, conversionScope);
            } catch (error) {
                const name = `${schema.name} (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})`;
                throw new Error(`The conversion of input ${name} is invalid: ${String(error)}`);
            }

            adapters.set(input.id, (value) => {
                conversionScope.assignParameter('Input', literal(value as never));
                const result = evaluate(adoptExpression, conversionScope);
                if (result.type === 'never') return undefined;
                return result;
            });
        } else {
            switch (input.kind) {
                case 'number':
                case 'slider':
                case 'text':
                case 'static': {
                    adapters.set(input.id, (value) => literal(value as never));
                    break;
                }

                case 'dropdown': {
                    const options = new Map<InputSchemaValue, NonNeverType>();
                    for (const o of input.options) {
                        if (o.type !== undefined) {
                            const name = `${o.option}=${JSON.stringify(o.value)} in ${inputName}`;

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
                    adapters.set(input.id, (value) => options.get(value));
                    break;
                }

                case 'generic':
                case 'file':
                case 'directory':
                case 'color':
                    break;

                default:
                    assertNever(input);
            }
        }
    }

    return adapters;
};

const getConversions = (schema: NodeSchema, scope: Scope): Map<InputId, InputConversion> => {
    const result = new Map<InputId, InputConversion>();
    for (const input of schema.inputs) {
        // eslint-disable-next-line no-continue
        if (input.conversions.length === 0) continue;

        const conversions: InputConversionItem[] = [];
        for (const item of input.conversions) {
            try {
                const type = evaluate(fromJson(item.type), scope);
                const convert = fromJson(item.convert);
                if (type.type === 'never') {
                    throw new Error('Conversion type cannot be never');
                }

                // verify that it's a valid conversion
                const conversionScope = getConversionScope(scope);
                conversionScope.assignParameter('Input', type);
                evaluate(convert, conversionScope);

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                conversions.push(new InputConversionItem(type, convert));
            } catch (error) {
                const name = `${schema.name} (id: ${schema.schemaId}) > ${input.label} (id: ${input.id})`;
                throw new Error(`The conversion of input ${name} is invalid: ${String(error)}`);
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        result.set(input.id, new InputConversion(conversions, scope));
    }
    return result;
};

export class InputConversionItem {
    readonly type: NonNeverType;

    readonly convert: Expression;

    constructor(type: NonNeverType, convert: Expression) {
        this.type = type;
        this.convert = convert;
    }
}
export class InputConversion {
    readonly convertibleTypes: Type;

    readonly conversions: readonly InputConversionItem[];

    private readonly scope: Scope;

    constructor(conversions: InputConversionItem[], scope: Scope) {
        this.conversions = conversions;
        this.convertibleTypes = union(...conversions.map((c) => c.type));
        this.scope = getConversionScope(scope);
    }

    convert(type: Type): Type {
        const converted: Type[] = [];
        for (const item of this.conversions) {
            const i = intersect(item.type, type);
            if (i.type !== 'never') {
                this.scope.assignParameter('Input', i);
                converted.push(evaluate(item.convert, this.scope));
                // eslint-disable-next-line no-param-reassign
                type = without(type, item.type);
            }
        }

        return union(type, ...converted);
    }
}

export class FunctionDefinition {
    readonly schema: NodeSchema;

    readonly scope: Scope;

    readonly inputDefaults: ReadonlyMap<InputId, NonNeverType>;

    readonly inputConvertibleDefaults: ReadonlyMap<InputId, NonNeverType>;

    readonly inputEvaluationOrder: readonly (InputDesc | IterInputDesc)[];

    readonly inputConversions: ReadonlyMap<InputId, InputConversion>;

    readonly outputDefaults: ReadonlyMap<OutputId, NonNeverType>;

    readonly outputEvaluationOrder: readonly (OutputDesc | IterOutputDesc)[];

    /**
     * Optional per-input functions that take the current input data for their
     * input and convert it into a type that is compatible with the input.
     */
    readonly inputDataAdapters: ReadonlyMap<
        InputId,
        (value: InputSchemaValue) => NonNeverType | undefined
    >;

    readonly inputNullable: Set<InputId>;

    readonly defaultInstance: FunctionInstance;

    private constructor(schema: NodeSchema, scope: Scope) {
        this.schema = schema;
        this.scope = scope;

        // inputs
        const inputs = evaluateInputs(schema, scope);
        this.inputEvaluationOrder = inputs.ordered;
        this.inputDefaults = new Map(inputs.inputs.map((i) => [i.input.id, i.default] as const));
        this.inputConversions = getConversions(schema, scope);
        this.inputConvertibleDefaults = new Map(
            [...this.inputDefaults].map(([id, d]) => {
                const c = this.inputConversions.get(id)?.convertibleTypes ?? NeverType.instance;
                return [id, union(d, c)] as const;
            })
        );

        // outputs
        const outputs = evaluateOutputs(schema, scope, inputs.ordered);
        this.outputEvaluationOrder = outputs.ordered;
        this.outputDefaults = new Map(
            outputs.outputs.map((o) => [o.output.id, o.default] as const)
        );

        // input literal values
        this.inputDataAdapters = getInputDataAdapters(schema, scope);
        this.inputNullable = new Set(schema.inputs.filter((i) => i.optional).map((i) => i.id));

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
        return conversion.convert(type);
    }

    canAssignInput(inputId: InputId, type: Type): boolean {
        const definitionType = this.inputDefaults.get(inputId);
        if (!definitionType) {
            throw new Error('Invalid input id');
        }
        return assignOk(this.convertInput(inputId, type), definitionType);
    }

    hasInput(inputId: InputId): boolean {
        return this.inputDefaults.has(inputId);
    }
}

export interface FunctionInputAssignmentError {
    inputId: InputId;
    inputType: NonNeverType;
    assignedType: NonNeverType;
}
export interface FunctionSequenceAssignmentError {
    inputId: InputId;
    sequenceType: NonNeverType;
    assignedSequenceType: NonNeverType;
}
export interface FunctionOutputError {
    outputId: OutputId;
    message: string | undefined;
}
export class FunctionInstance {
    readonly definition: FunctionDefinition;

    readonly inputs: ReadonlyMap<InputId, NonNeverType>;

    readonly outputs: ReadonlyMap<OutputId, NonNeverType>;

    readonly inputErrors: readonly FunctionInputAssignmentError[];

    readonly sequenceErrors: readonly FunctionSequenceAssignmentError[];

    readonly outputErrors: readonly FunctionOutputError[];

    readonly inputSequence: ReadonlyMap<InputId, NonNeverType>;

    readonly outputSequence: ReadonlyMap<OutputId, NonNeverType>;

    private constructor(
        definition: FunctionDefinition,
        inputs: ReadonlyMap<InputId, NonNeverType>,
        outputs: ReadonlyMap<OutputId, NonNeverType>,
        inputErrors: readonly FunctionInputAssignmentError[],
        sequenceErrors: readonly FunctionSequenceAssignmentError[],
        outputErrors: readonly FunctionOutputError[],
        inputSequence: ReadonlyMap<InputId, NonNeverType>,
        outputSequence: ReadonlyMap<OutputId, NonNeverType>
    ) {
        this.definition = definition;
        this.inputs = inputs;
        this.outputs = outputs;
        this.inputErrors = inputErrors;
        this.sequenceErrors = sequenceErrors;
        this.outputErrors = outputErrors;
        this.inputSequence = inputSequence;
        this.outputSequence = outputSequence;
    }

    static fromDefinition(definition: FunctionDefinition): FunctionInstance {
        return new FunctionInstance(
            definition,
            definition.inputDefaults,
            definition.outputDefaults,
            [],
            [],
            [],
            new Map(),
            new Map()
        );
    }

    static fromPartialInputs(
        definition: FunctionDefinition,
        partialInputs: (
            inputId: InputId
        ) => { type: NonNeverType; sequence: NonNeverType | undefined } | undefined,
        outputNarrowing: ReadonlyMap<OutputId, Type> = EMPTY_MAP,
        sequenceOutputNarrowing: ReadonlyMap<IterOutputId, Type> = EMPTY_MAP,
        passthrough?: PassthroughInfo
    ): FunctionInstance {
        const inputErrors: FunctionInputAssignmentError[] = [];
        const sequenceErrors: FunctionSequenceAssignmentError[] = [];
        const outputErrors: FunctionOutputError[] = [];

        // scope
        const scopeBuilder = new ScopeBuilder('function instance', definition.scope);
        for (const { param, default: type } of definition.inputEvaluationOrder) {
            scopeBuilder.add(new ParameterDefinition(param, type));
        }
        for (const { param, default: type } of definition.outputEvaluationOrder) {
            scopeBuilder.add(new ParameterDefinition(param, type));
        }
        const scope = scopeBuilder.createScope();

        // Build a map from InputId to its IterInput (for nodes with explicit iteratorInputs)
        // This allows us to collect incoming sequences per iterator group
        const inputToIterInput = new Map<InputId, IterInputId>();
        for (const iterInput of definition.schema.iteratorInputs) {
            for (const inputId of iterInput.inputs) {
                inputToIterInput.set(inputId, iterInput.id);
            }
        }

        // Track incoming sequence types per IterInput group
        // When we process an IterInput item, we'll intersect these with the declared type
        interface IncomingSequenceData {
            inputId: InputId;
            sequence: NonNeverType;
        }
        const incomingSequencesByIterInput = new Map<IterInputId, IncomingSequenceData[]>();

        // Track incoming sequence types for regular nodes (no explicit iteratorInputs)
        // We'll intersect all of them to get the common sequence type
        const incomingSequencesForRegularNode: IncomingSequenceData[] = [];

        // evaluate inputs
        const inputs = new Map<InputId, NonNeverType>();
        const inputLengths = new Map<InputId, NonNeverType>();
        for (const item of definition.inputEvaluationOrder) {
            let type: Type;
            if (item.expression) {
                type = evaluate(item.expression, scope);
            } else {
                type = item.default;
            }

            if (type.type !== 'never' && item.type === 'Input') {
                const { id } = item.input;
                const assigned = partialInputs(id);
                if (assigned) {
                    const converted = definition.convertInput(id, assigned.type);
                    const newType = assign(converted, type).assignedType;
                    if (newType.type === 'never') {
                        inputErrors.push({
                            inputId: id,
                            inputType: type,
                            assignedType: assigned.type,
                        });
                    }
                    type = newType;

                    // Collect incoming sequence types
                    if (assigned.sequence) {
                        const iterInputId = inputToIterInput.get(id);
                        if (iterInputId !== undefined) {
                            // This input belongs to an explicit IterInput group
                            // Collect the sequence for later narrowing when we process the IterInput
                            let sequences = incomingSequencesByIterInput.get(iterInputId);
                            if (!sequences) {
                                sequences = [];
                                incomingSequencesByIterInput.set(iterInputId, sequences);
                            }
                            sequences.push({ inputId: id, sequence: assigned.sequence });
                        } else if (
                            definition.schema.kind === 'regularNode' &&
                            item.input.hasHandle
                        ) {
                            // For regular nodes, collect all incoming sequences
                            incomingSequencesForRegularNode.push({
                                inputId: id,
                                sequence: assigned.sequence,
                            });
                            inputLengths.set(id, assigned.sequence);
                        }
                    }
                }
            }

            if (type.type === 'never') {
                // If the output type is never, then there is some error with the input.
                // However, we don't have the means to communicate this error yet, so we'll just
                // ignore it for now.
                type = item.default;
            }

            if (item.type === 'Input') {
                inputs.set(item.input.id, type);
            } else {
                // IterInput item: narrow the declared sequence type with incoming sequences
                const incomingSequencesData = incomingSequencesByIterInput.get(item.iterInput.id);
                let finalSequenceType: NonNeverType = type;

                if (incomingSequencesData && incomingSequencesData.length > 0) {
                    // First, check if all incoming sequences are compatible with each other
                    let combinedIncoming: NonNeverType = incomingSequencesData[0].sequence;
                    let incomingSequencesCompatible = true;
                    for (let i = 1; i < incomingSequencesData.length; i += 1) {
                        const newCombined: Type = intersect(
                            combinedIncoming,
                            incomingSequencesData[i].sequence
                        );
                        if (newCombined.type === 'never') {
                            // Incoming sequences are incompatible with each other
                            // Report errors comparing them to the first sequence
                            incomingSequencesCompatible = false;
                            for (let j = 1; j < incomingSequencesData.length; j += 1) {
                                sequenceErrors.push({
                                    inputId: incomingSequencesData[j].inputId,
                                    sequenceType: incomingSequencesData[0].sequence,
                                    assignedSequenceType: incomingSequencesData[j].sequence,
                                });
                            }
                            break;
                        }
                        combinedIncoming = newCombined;
                    }

                    if (incomingSequencesCompatible) {
                        // Now intersect with the declared sequence type (assignability check)
                        // This checks that the incoming sequences are compatible with what the node expects
                        const narrowedType = intersect(combinedIncoming, type);

                        if (narrowedType.type === 'never') {
                            // Incoming sequences don't match the declared type
                            for (const data of incomingSequencesData) {
                                sequenceErrors.push({
                                    inputId: data.inputId,
                                    sequenceType: type,
                                    assignedSequenceType: data.sequence,
                                });
                            }
                            finalSequenceType = type;
                        } else {
                            finalSequenceType = narrowedType;
                        }
                    }
                }

                // Set the sequence type for all inputs in this iterator group
                for (const id of item.iterInput.inputs) {
                    inputLengths.set(id, finalSequenceType);
                }
                type = finalSequenceType;
            }
            scope.assignParameter(item.param, type);
        }

        // For regular nodes, compute the common sequence type by intersecting all incoming sequences
        let regularNodeSequenceType: NonNeverType | undefined;
        if (
            definition.schema.kind === 'regularNode' &&
            incomingSequencesForRegularNode.length > 0
        ) {
            // Intersect all incoming sequence types
            // This ensures all sequences have compatible lengths
            let combinedSequence: NonNeverType = incomingSequencesForRegularNode[0].sequence;
            let hasSequenceError = false;
            for (let i = 1; i < incomingSequencesForRegularNode.length; i += 1) {
                const newCombined: Type = intersect(
                    combinedSequence,
                    incomingSequencesForRegularNode[i].sequence
                );
                if (newCombined.type === 'never') {
                    // Incompatible sequence lengths - generate errors for all inputs with sequences
                    // The first input's sequence is the "expected" type, others are incompatible
                    for (let j = 1; j < incomingSequencesForRegularNode.length; j += 1) {
                        sequenceErrors.push({
                            inputId: incomingSequencesForRegularNode[j].inputId,
                            sequenceType: incomingSequencesForRegularNode[0].sequence,
                            assignedSequenceType: incomingSequencesForRegularNode[j].sequence,
                        });
                    }
                    hasSequenceError = true;
                    break;
                }
                combinedSequence = newCombined;
            }
            if (!hasSequenceError) {
                regularNodeSequenceType = combinedSequence;
            }
        }

        // evaluate outputs
        const outputs = new Map<OutputId, NonNeverType>();
        const outputLengths = new Map<OutputId, NonNeverType>();
        if (passthrough) {
            // pass through the mapped inputs

            for (const item of definition.outputEvaluationOrder) {
                if (item.type === 'Output') {
                    const { id } = item.output;
                    const mappedInput = passthrough.getInput(id);
                    const type = inputs.get(mappedInput)!; // we set all inputs
                    outputs.set(id, type);
                    const mappedInputLength = inputLengths.get(mappedInput);
                    if (mappedInputLength) outputLengths.set(id, mappedInputLength);
                }
            }
        } else {
            // compute outputs normally

            for (const item of definition.outputEvaluationOrder) {
                let type: Type;
                if (item.expression) {
                    type = evaluate(item.expression, scope);

                    if (item.type === 'Output') {
                        const { id } = item.output;
                        if (type.type === 'never') {
                            const message = item.output.neverReason ?? undefined;
                            outputErrors.push({ outputId: id, message });
                        } else {
                            let message;
                            [type, message] = splitOutputTypeAndError(type);
                            if (type.type === 'never') {
                                outputErrors.push({ outputId: id, message });
                            }
                        }
                    }
                } else {
                    type = item.default;
                }

                const narrowing =
                    item.type === 'Output'
                        ? outputNarrowing.get(item.output.id)
                        : sequenceOutputNarrowing.get(item.iterOutput.id);
                if (narrowing) {
                    type = intersect(narrowing, type);
                }

                if (type.type === 'never') {
                    // If the output type is never, then there is some error with the input.
                    // However, we don't have the means to communicate this error yet, so we'll just
                    // ignore it for now.
                    type = item.default;
                }

                if (item.type === 'Output') {
                    outputs.set(item.output.id, type);
                    scope.assignParameter(getOutputParamName(item.output.id), type);

                    // For regular nodes, propagate the intersected sequence type to all outputs
                    if (regularNodeSequenceType) {
                        outputLengths.set(item.output.id, regularNodeSequenceType);
                    }
                } else {
                    for (const id of item.iterOutput.outputs) {
                        outputLengths.set(id, type);
                    }
                }
                scope.assignParameter(item.param, type);
            }
        }

        return new FunctionInstance(
            definition,
            inputs,
            outputs,
            inputErrors,
            sequenceErrors,
            outputErrors,
            inputLengths,
            outputLengths
        );
    }

    canAssign(inputId: InputId, type: Type): boolean {
        const definitionType = this.definition.inputDefaults.get(inputId);
        if (!definitionType) throw new Error(`Invalid input id ${inputId}`);

        // we say that types A is assignable to type B if they are not disjoint
        return assignOk(this.definition.convertInput(inputId, type), definitionType);
    }
}
