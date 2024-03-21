import { Edge, Node } from 'reactflow';
import { EdgeData, NodeData } from '../common-types';
import { SchemaMap } from '../SchemaMap';
import { getDefaultValue } from '../util';
import { getEffectivelyDisabledNodes } from './disabled';
import { getNodesWithSideEffects } from './sideEffect';

const trimEdges = (
    nodes: Iterable<Node<NodeData>>,
    edges: readonly Edge<EdgeData>[]
): Edge<EdgeData>[] => {
    const nodeIds = new Set<string>();
    for (const n of nodes) {
        nodeIds.add(n.id);
    }

    return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
};

const removeUnusedSideEffectNodes = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap
): Node<NodeData>[] => {
    // eslint-disable-next-line no-param-reassign
    edges = trimEdges(nodes, edges);

    const connectedNodes = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);

    return nodes.filter((n) => {
        if (connectedNodes.has(n.id)) {
            // the node isn't unused
            return true;
        }

        const schema = schemata.get(n.data.schemaId);
        if (!schema.hasSideEffects) {
            // we only care about nodes with side effects
            return true;
        }

        // if all inputs don't require connections, that's fine too
        const requireConnection = schema.inputs.some(
            (i) => !i.optional && getDefaultValue(i) === undefined
        );
        if (!requireConnection) {
            return true;
        }

        // the is unused, has side effects, and requires connections
        return false;
    });
};

interface OptimizedChain {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
    report: {
        /** How many effectively disabled nodes were removed. */
        removedDisabled: number;
        /** How many side-effect-free nodes were removed. */
        removedSideEffectFree: number;
    };
}

export const optimizeChain = (
    unoptimizedNodes: readonly Node<NodeData>[],
    unoptimizedEdges: readonly Edge<EdgeData>[],
    schemata: SchemaMap
): OptimizedChain => {
    // remove disabled nodes
    const disabledNodes = new Set(getEffectivelyDisabledNodes(unoptimizedNodes, unoptimizedEdges));
    const enabledNodes = unoptimizedNodes.filter((n) => !disabledNodes.has(n));

    // remove nodes without side effects
    let withEffect = getNodesWithSideEffects(enabledNodes, unoptimizedEdges, schemata);
    withEffect = removeUnusedSideEffectNodes(withEffect, unoptimizedEdges, schemata);

    return {
        nodes: withEffect,
        edges: trimEdges(withEffect, unoptimizedEdges),
        report: {
            removedDisabled: disabledNodes.size,
            removedSideEffectFree: enabledNodes.length - withEffect.length,
        },
    };
};
