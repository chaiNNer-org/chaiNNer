import { NeverType, isDisjointWith } from '@chainner/navi';
import { InputId, NodeSchema, Output, OutputId, SchemaId } from './common-types';
import { FunctionDefinition } from './types/function';
import { EMPTY_MAP } from './util';

export class PassthroughInfo {
    readonly schema: NodeSchema;

    readonly mapping: ReadonlyMap<OutputId, InputId>;

    constructor(schema: NodeSchema, mapping: ReadonlyMap<OutputId, InputId>) {
        this.schema = schema;
        this.mapping = mapping;

        if (schema.outputs.length !== mapping.size) {
            throw new Error(`Invalid passthrough mapping for ${schema.schemaId}`);
        }
    }

    getInput(outputId: OutputId): InputId {
        const inputId = this.mapping.get(outputId);
        if (inputId === undefined) {
            throw new Error(
                `Invalid output ID: ${outputId} is not an output ID of ${this.schema.schemaId}`
            );
        }
        return inputId;
    }

    isMappedInput(inputId: InputId): boolean {
        for (const id of this.mapping.values()) {
            if (id === inputId) {
                return true;
            }
        }
        return false;
    }
}

const guessPassthroughInput = (
    { schema, inputDefaults, outputDefaults }: FunctionDefinition,
    output: Output
): InputId | undefined => {
    if (schema.hasSideEffects) {
        // it's not clear how pass through should behave for nodes with side effects
        return undefined;
    }
    if (!output.hasHandle) {
        // passthrough is only relevant for outputs with a handle
        return undefined;
    }
    if (schema.kind !== 'regularNode') {
        // handling iterators is too complex for now
        return undefined;
    }
    if (schema.inputs.length === 0) {
        // no inputs, no passthrough
        return undefined;
    }

    // The strategy for picking an input is as follows:
    // 1. Pick the first input.
    // That's it.
    const candidate = schema.inputs[0];
    if (!candidate.hasHandle || candidate.optional) {
        // we need a handle and we need a value
        return undefined;
    }

    if (candidate.fused?.outputId === output.id) {
        // passthrough doesn't do anything for nodes that already pass the input value through
        return undefined;
    }

    const inputType = inputDefaults.get(candidate.id) ?? NeverType.instance;
    const outputType = outputDefaults.get(output.id) ?? NeverType.instance;
    if (isDisjointWith(inputType, outputType)) {
        // the output type is not compatible with the input type
        return undefined;
    }

    return candidate.id;
};

export class PassthroughMap {
    private readonly data: ReadonlyMap<SchemaId, PassthroughInfo>;

    private constructor(data: ReadonlyMap<SchemaId, PassthroughInfo>) {
        this.data = data;
    }

    static readonly EMPTY: PassthroughMap = new PassthroughMap(EMPTY_MAP);

    static create(functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>): PassthroughMap {
        const data = new Map<SchemaId, PassthroughInfo>();

        for (const [schemaId, definition] of functionDefinitions) {
            const { schema } = definition;
            const mapping = new Map<OutputId, InputId>();

            for (const output of schema.outputs) {
                if (output.passthroughOf != null) {
                    // the passthrough input is explicitly defined
                    mapping.set(output.id, output.passthroughOf);
                }
            }

            if (mapping.size === 0 && schema.outputs.length === 1) {
                const output = schema.outputs[0];
                const inputId = guessPassthroughInput(definition, output);
                if (inputId != null) {
                    mapping.set(output.id, inputId);
                }
            }

            if (mapping.size > 0 && mapping.size === schema.outputs.length) {
                data.set(schemaId, new PassthroughInfo(schema, mapping));
            }
        }

        return new PassthroughMap(data);
    }

    get(schemaId: SchemaId): PassthroughInfo | undefined {
        return this.data.get(schemaId);
    }
}
