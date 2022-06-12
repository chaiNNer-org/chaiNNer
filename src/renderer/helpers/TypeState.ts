import { Edge, Node } from 'react-flow-renderer';
import { EdgeData, NodeData } from '../../common/common-types';
import { EvaluationError } from '../../common/types/evaluate';
import { FunctionDefinition, FunctionInstance } from '../../common/types/function';
import { NumericLiteralType, StringLiteralType, Type } from '../../common/types/types';
import { parseHandle } from '../../common/util';

export class TypeState {
    readonly functions: ReadonlyMap<string, FunctionInstance>;

    readonly invalidEdges: ReadonlySet<string>;

    readonly evaluationErrors: ReadonlyMap<string, EvaluationError>;

    private constructor(
        functions: TypeState['functions'],
        invalidEdges: TypeState['invalidEdges'],
        evaluationErrors: TypeState['evaluationErrors']
    ) {
        this.functions = functions;
        this.invalidEdges = invalidEdges;
        this.evaluationErrors = evaluationErrors;
    }

    static readonly empty = new TypeState(new Map(), new Set(), new Map());

    static create(
        nodes: readonly Node<NodeData>[],
        edges: readonly Edge<EdgeData>[],
        functionDefinitions: ReadonlyMap<string, FunctionDefinition>
    ): TypeState {
        // eslint-disable-next-line no-param-reassign
        edges = edges.filter((e) => e.sourceHandle && e.targetHandle);

        const byId = new Map(nodes.map((n) => [n.id, n]));
        const byTargetHandle = new Map(edges.map((e) => [e.targetHandle!, e]));

        const functions = new Map<string, FunctionInstance>();
        const evaluationErrors = new Map<string, EvaluationError>();
        const edgesToCheck: [nodeId: string, inputId: number][] = [];

        const getSourceType = (id: string, inputId: number): Type | undefined => {
            const edge = byTargetHandle.get(`${id}-${inputId}`);
            if (edge) {
                const sourceHandle = parseHandle(edge.sourceHandle!);
                const sourceNode = byId.get(sourceHandle.nodeId);
                if (sourceNode) {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    const functionInstance = addNode(sourceNode);
                    return functionInstance.outputs.get(sourceHandle.inOutId);
                }
            }
            return undefined;
        };
        const addNode = (n: Node<NodeData>): FunctionInstance => {
            const cached = functions.get(n.id);
            if (cached) return cached;

            const definition = functionDefinitions.get(n.data.schemaId);
            if (!definition) {
                throw new Error(`No function definition for schema id ${n.data.schemaId}`);
            }

            let instance;
            try {
                instance = FunctionInstance.fromPartialInputs(definition, (id) => {
                    const edgeSource = getSourceType(n.id, id);
                    if (edgeSource) {
                        if (edgeSource.type !== 'never') {
                            // we want to check non-trivial edges
                            edgesToCheck.push([n.id, id]);
                        }
                        return edgeSource;
                    }

                    if (definition.inputDataLiterals.has(id)) {
                        const inputValue = n.data.inputData[id];
                        if (inputValue !== undefined) {
                            if (typeof inputValue === 'number') {
                                return new NumericLiteralType(inputValue);
                            }
                            return new StringLiteralType(inputValue);
                        }
                    }

                    return undefined;
                });
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

        for (const n of nodes) {
            addNode(n);
        }

        const invalidEdges = new Set<string>();
        for (const [nodeId, inputId] of edgesToCheck) {
            const fn = functions.get(nodeId)!;

            if (fn.inputs.get(inputId)!.type === 'never') {
                const edge = byTargetHandle.get(`${nodeId}-${inputId}`)!;
                invalidEdges.add(edge.id);
            }
        }

        return new TypeState(functions, invalidEdges, evaluationErrors);
    }
}
