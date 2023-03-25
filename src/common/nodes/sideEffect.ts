import { EdgeData, NodeData } from '../common-types';
import { SchemaMap } from '../SchemaMap';
import type { Edge, Node } from 'reactflow';

/**
 * Returns a list of all nodes with side effects and nodes that are inputs of nodes with side
 * effects (directly or indirectly).
 */
export const getNodesWithSideEffects = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap
): Node<NodeData>[] => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const outgoingMap = new Map<Node<NodeData>, Node<NodeData>[]>();
    for (const e of edges) {
        const source = byId.get(e.source);
        const target = byId.get(e.target);
        if (source && target) {
            let outgoing = outgoingMap.get(source);
            if (outgoing === undefined) {
                outgoing = [];
                outgoingMap.set(source, outgoing);
            }
            outgoing.push(target);
        }
    }

    const cache = new Map<Node<NodeData>, boolean>();
    const hasSideEffectsUncached = (n: Node<NodeData>): boolean => {
        const schema = schemata.get(n.data.schemaId);
        if (schema.hasSideEffects) {
            return true;
        }

        const outgoing = outgoingMap.get(n) ?? [];
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return outgoing.some(hasSideEffects);
    };
    const hasSideEffects = (n: Node<NodeData>): boolean => {
        let cached = cache.get(n);
        if (cached === undefined) {
            cached = hasSideEffectsUncached(n);
            cache.set(n, cached);
        }
        return cached;
    };

    return nodes.filter(hasSideEffects);
};
