import { EvaluationError, NonNeverType, Type, isSameType } from '@chainner/navi';
import { EdgeData, InputId, NodeData, OutputId, SchemaId } from '../common-types';
import { log } from '../log';
import { PassthroughMap } from '../PassthroughMap';
import {
    FunctionDefinition,
    FunctionInputAssignmentError,
    FunctionInstance,
} from '../types/function';
import { nullType } from '../types/util';
import { EMPTY_MAP } from '../util';
import { EdgeState } from './EdgeState';
import type { Edge, Node } from 'reactflow';

const assignmentErrorEquals = (
    a: FunctionInputAssignmentError,
    b: FunctionInputAssignmentError
): boolean => {
    return (
        a.inputId === b.inputId &&
        isSameType(a.assignedType, b.assignedType) &&
        isSameType(a.inputType, b.inputType)
    );
};
const instanceEqual = (a: FunctionInstance, b: FunctionInstance): boolean => {
    if (a.definition !== b.definition) return false;

    for (const [key, value] of a.inputs) {
        const otherValue = b.inputs.get(key);
        if (!otherValue || !isSameType(value, otherValue)) return false;
    }

    for (const [key, value] of a.outputs) {
        const otherValue = b.outputs.get(key);
        if (!otherValue || !isSameType(value, otherValue)) return false;
    }

    if (a.inputErrors.length !== b.inputErrors.length) return false;
    for (let i = 0; i < a.inputErrors.length; i += 1) {
        if (!assignmentErrorEquals(a.inputErrors[i], b.inputErrors[i])) return false;
    }

    return true;
};

export class TypeState {
    readonly functions: ReadonlyMap<string, FunctionInstance>;

    readonly evaluationErrors: ReadonlyMap<string, EvaluationError>;

    readonly edges: EdgeState;

    private constructor(
        functions: TypeState['functions'],
        evaluationErrors: TypeState['evaluationErrors'],
        edges: TypeState['edges']
    ) {
        this.functions = functions;
        this.evaluationErrors = evaluationErrors;
        this.edges = edges;
    }

    static readonly empty = new TypeState(EMPTY_MAP, EMPTY_MAP, EdgeState.empty);

    static create(
        nodesMap: ReadonlyMap<string, Node<NodeData>>,
        rawEdges: readonly Edge<EdgeData>[],
        outputNarrowing: ReadonlyMap<string, ReadonlyMap<OutputId | 'length', Type>>,
        functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>,
        passthrough?: PassthroughMap,
        previousTypeState?: TypeState
    ): TypeState {
        const edges = EdgeState.create(rawEdges);

        const functions = new Map<string, FunctionInstance>();
        const evaluationErrors = new Map<string, EvaluationError>();

        const getSourceType = (id: string, inputId: InputId): NonNeverType | undefined => {
            const edge = edges.get(id, inputId);
            if (edge) {
                const sourceNode = nodesMap.get(edge.source);
                if (sourceNode) {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    const functionInstance = addNode(sourceNode);
                    return functionInstance?.outputs.get(edge.outputId);
                }
            }
            return undefined;
        };
        const addNode = (n: Node<NodeData>): FunctionInstance | undefined => {
            const cached = functions.get(n.id);
            if (cached) return cached;

            const definition = functionDefinitions.get(n.data.schemaId);
            if (!definition) {
                log.warn(`Unknown schema id ${n.data.schemaId}`);
                return undefined;
            }

            const passthroughInfo = n.data.isPassthrough
                ? passthrough?.get(n.data.schemaId)
                : undefined;

            let instance;
            try {
                instance = FunctionInstance.fromPartialInputs(
                    definition,
                    (id): NonNeverType | undefined => {
                        const edgeSource = getSourceType(n.id, id);
                        if (edgeSource) {
                            return edgeSource;
                        }

                        const inputValue = n.data.inputData[id];

                        if (inputValue !== undefined) {
                            const foo = definition.inputDataAdapters.get(id)?.(inputValue);
                            if (foo !== undefined) {
                                return foo;
                            }
                        }

                        if (inputValue === undefined && definition.inputNullable.has(id)) {
                            return nullType;
                        }

                        return undefined;
                    },
                    outputNarrowing.get(n.id),
                    passthroughInfo
                );
            } catch (error) {
                if (error instanceof EvaluationError) {
                    evaluationErrors.set(n.id, error);
                } else {
                    throw error;
                }
                instance = definition.defaultInstance;
            }

            const previousInstance = previousTypeState?.functions.get(n.id);
            if (previousInstance && instanceEqual(previousInstance, instance)) {
                instance = previousInstance;
            }

            functions.set(n.id, instance);
            return instance;
        };

        for (const n of nodesMap.values()) {
            addNode(n);
        }

        return new TypeState(functions, evaluationErrors, edges);
    }
}
