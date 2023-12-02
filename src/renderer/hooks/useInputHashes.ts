import { useEffect, useRef } from 'react';
import { Edge, Node, useReactFlow } from 'reactflow';
import { EdgeData, NodeData } from '../../common/common-types';
import { SchemaMap } from '../../common/SchemaMap';
import { EMPTY_MAP, deriveUniqueId, stringifyTargetHandle } from '../../common/util';

const EMPTY = '6227edf5-cc54-4d34-b863-f647d3a73509';

/**
 * Given a graph, this will returns a map from node id to the input hash of the node with that id.
 *
 * An input hash is a representation of the inputs for a node. If the input hash changes, at least
 * of its inputs changed. At least, that's the idea. Due to the imperfect nature of hashes, input
 * hashes only guarantee that if the input hash doesn't change, that the inputs for a node did not
 * change.
 */
const computeInputHashes = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap,
): Map<string, string> => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const byTargetHandle = new Map(
        edges.filter((e) => e.targetHandle).map((e) => [e.targetHandle!, e]),
    );

    const hashes = new Map<string, string>();
    const getInputHash = (node: Node<NodeData>): string => {
        let hash = hashes.get(node.id);
        if (hash) return hash;

        const schema = schemata.get(node.data.schemaId);
        const inputs: string[] = [node.data.schemaId];
        for (const input of schema.inputs) {
            const connectedEdge = byTargetHandle.get(
                stringifyTargetHandle({ nodeId: node.id, inputId: input.id }),
            );
            if (connectedEdge) {
                const source = byId.get(connectedEdge.source);
                if (source) {
                    // input gets passed by the connected node
                    inputs.push(getInputHash(source));
                    // eslint-disable-next-line no-continue
                    continue;
                }
            }

            const value = node.data.inputData[input.id];
            // eslint-disable-next-line eqeqeq
            if (value == undefined) {
                inputs.push(EMPTY);
            } else {
                inputs.push(deriveUniqueId(String(value)));
            }
        }

        hash = deriveUniqueId(inputs.join(';'));
        hashes.set(node.id, hash);
        return hash;
    };

    for (const node of nodes) {
        getInputHash(node);
    }

    return hashes;
};

export const useInputHashes = (schemata: SchemaMap, deps: readonly unknown[]) => {
    const ref = useRef<ReadonlyMap<string, string>>(EMPTY_MAP);

    const { getNodes, getEdges } = useReactFlow();
    useEffect(() => {
        ref.current = computeInputHashes(getNodes(), getEdges(), schemata);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return ref;
};
