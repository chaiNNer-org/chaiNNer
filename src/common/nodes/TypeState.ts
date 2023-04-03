import { EvaluationError, NonNeverType, StructType, Type } from '@chainner/navi';
import log from 'electron-log';
import { EdgeData, InputId, NodeData, OutputId, SchemaId } from '../common-types';
import { FunctionDefinition, FunctionInstance } from '../types/function';
import {
    EMPTY_ARRAY,
    EMPTY_MAP,
    parseSourceHandle,
    parseTargetHandle,
    stringifyTargetHandle,
} from '../util';
import type { Edge, Node } from 'reactflow';

export interface TypeStateEdge {
    readonly from: readonly [node: string, outputId: OutputId];
    readonly to: readonly [node: string, inputId: InputId];
}

export class TypeState {
    readonly functions: ReadonlyMap<string, FunctionInstance>;

    readonly evaluationErrors: ReadonlyMap<string, EvaluationError>;

    readonly edges: readonly TypeStateEdge[];

    private constructor(
        functions: TypeState['functions'],
        evaluationErrors: TypeState['evaluationErrors'],
        edges: TypeState['edges']
    ) {
        this.functions = functions;
        this.evaluationErrors = evaluationErrors;
        this.edges = edges;
    }

    static readonly empty = new TypeState(EMPTY_MAP, EMPTY_MAP, EMPTY_ARRAY);

    static create(
        nodesMap: ReadonlyMap<string, Node<NodeData>>,
        edges: readonly Edge<EdgeData>[],
        outputNarrowing: ReadonlyMap<string, ReadonlyMap<OutputId, Type>>,
        functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>
    ): TypeState {
        // eslint-disable-next-line no-param-reassign
        edges = edges.filter((e) => e.sourceHandle && e.targetHandle);

        const byTargetHandle = new Map(edges.map((e) => [e.targetHandle!, e]));

        const functions = new Map<string, FunctionInstance>();
        const evaluationErrors = new Map<string, EvaluationError>();

        const getSourceType = (id: string, inputId: InputId): NonNeverType | undefined => {
            const edge = byTargetHandle.get(stringifyTargetHandle({ nodeId: id, inputId }));
            if (edge && edge.sourceHandle) {
                const sourceHandle = parseSourceHandle(edge.sourceHandle);
                const sourceNode = nodesMap.get(sourceHandle.nodeId);
                if (sourceNode) {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    const functionInstance = addNode(sourceNode);
                    return functionInstance?.outputs.get(sourceHandle.outputId);
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
                            return new StructType('null');
                        }

                        return undefined;
                    },
                    outputNarrowing.get(n.id)
                );
            } catch (error) {
                if (error instanceof EvaluationError) {
                    evaluationErrors.set(n.id, error);
                } else {
                    throw error;
                }
                instance = definition.defaultInstance;
            }

            functions.set(n.id, instance);
            return instance;
        };

        for (const n of nodesMap.values()) {
            addNode(n);
        }

        const tsEdges: TypeStateEdge[] = edges.map((e) => {
            const from = parseSourceHandle(e.sourceHandle!);
            const to = parseTargetHandle(e.targetHandle!);
            return { from: [from.nodeId, from.outputId], to: [to.nodeId, to.inputId] };
        });

        return new TypeState(functions, evaluationErrors, tsEdges);
    }

    isInputConnected(nodeId: string, inputId: InputId): boolean {
        return this.edges.some((e) => e.to[0] === nodeId && e.to[1] === inputId);
    }
}
