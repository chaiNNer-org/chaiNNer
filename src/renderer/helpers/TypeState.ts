import { Edge, Node } from 'react-flow-renderer';
import { EdgeData, NodeData } from '../../common/common-types';
import { FunctionDefinition, FunctionInstance } from '../../common/types/function';

export class TypeState {
    readonly functions: ReadonlyMap<string, FunctionInstance>;

    readonly invalidEdges: ReadonlyMap<string, Edge<EdgeData>>;

    readonly evaluationErrors: ReadonlyMap<string, string>;

    private constructor(
        functions: TypeState['functions'],
        invalidEdges: TypeState['invalidEdges'],
        evaluationErrors: TypeState['evaluationErrors']
    ) {
        this.functions = functions;
        this.invalidEdges = invalidEdges;
        this.evaluationErrors = evaluationErrors;
    }

    static readonly empty = new TypeState(new Map(), new Map(), new Map());

    private copyFunctionMap(
        nodes: readonly Node<NodeData>[],
        functionDefinitions: ReadonlyMap<string, FunctionDefinition>
    ): [Map<string, FunctionInstance>, boolean] {
        const fn = new Map(this.functions);
        let didChange = false;

        // add missing nodes
        for (const n of nodes) {
            if (!fn.has(n.id)) {
                const def = functionDefinitions.get(n.data.schemaId);
                if (!def) {
                    throw new Error(`Unknown schema id: ${n.data.schemaId}`);
                }
                fn.set(n.id, def.instantiate());
                didChange = true;
            }
        }

        // remove old nodes
        if (fn.size !== nodes.length) {
            didChange = true;
            const present = new Set(nodes.map((n) => n.id));
            for (const key of [...fn.keys()].filter((k) => !present.has(k))) {
                fn.delete(key);
            }
        }

        return [fn, didChange];
    }

    update(
        nodes: readonly Node<NodeData>[],
        edges: readonly Edge<EdgeData>[],
        functionDefinitions: ReadonlyMap<string, FunctionDefinition>
    ): TypeState {
        const [fn, didChange] = this.copyFunctionMap(nodes, functionDefinitions);

        if (!didChange) return this;
    }
}
