import {
    EvaluationError,
    NonNeverType,
    NumericLiteralType,
    StringLiteralType,
    StructType,
    Type,
} from '@chainner/navi';
import log from 'electron-log';
import { Edge, Node } from 'reactflow';
import { EdgeData, InputId, NodeData, OutputId, SchemaId } from '../../common/common-types';
import { FunctionDefinition, FunctionInstance } from '../../common/types/function';
import { EMPTY_MAP, parseSourceHandle, stringifyTargetHandle } from '../../common/util';

export class TypeState {
    readonly functions: ReadonlyMap<string, FunctionInstance>;

    readonly evaluationErrors: ReadonlyMap<string, EvaluationError>;

    private constructor(
        functions: TypeState['functions'],
        evaluationErrors: TypeState['evaluationErrors']
    ) {
        this.functions = functions;
        this.evaluationErrors = evaluationErrors;
    }

    static readonly empty = new TypeState(EMPTY_MAP, EMPTY_MAP);

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
                            if (definition.inputDataLiterals.has(id)) {
                                if (typeof inputValue === 'number') {
                                    return new NumericLiteralType(inputValue);
                                }
                                return new StringLiteralType(inputValue);
                            }

                            const optionTypes = definition.inputOptions.get(id);
                            if (optionTypes) {
                                const currentOption = optionTypes.get(inputValue);
                                if (currentOption) {
                                    return currentOption;
                                }
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

        return new TypeState(functions, evaluationErrors);
    }
}
