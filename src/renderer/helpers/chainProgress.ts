import { Edge, Node } from 'reactflow';
import { EdgeData, NodeData } from '../../common/common-types';
import { SchemaMap } from '../../common/SchemaMap';

export type ChainProgress = ReadonlyMap<string, ChainNodeProgress>;

export interface ChainNodeProgress {
    readonly progress: number;
    readonly weight: number;
}

export const getTotalProgress = (chainProgress: ChainProgress): number => {
    if (chainProgress.size === 0) return 0;
    let totalProgress = 0;
    let totalWeight = 0;
    for (const { progress, weight } of chainProgress.values()) {
        totalProgress += progress * weight;
        totalWeight += weight;
    }
    return totalProgress / totalWeight;
};

export const withNodeProgress = (
    chainProgress: ChainProgress,
    nodeId: string,
    progress: number
): ChainProgress => {
    const node = chainProgress.get(nodeId);
    if (!node) return chainProgress;
    return new Map(chainProgress).set(nodeId, { progress, weight: node.weight });
};

export const getInitialChainProgress = (
    nodes: readonly Node<NodeData>[],

    _edges: readonly Edge<EdgeData>[],

    schemata: SchemaMap
): ChainProgress => {
    const progress = new Map<string, ChainNodeProgress>();

    // TODO: implement proper weights based on iterated nodes

    for (const node of nodes) {
        let weight = 1;
        if (schemata.get(node.data.schemaId).nodeType === 'newIterator') {
            // more weight for iterators
            weight = 4;
        }
        progress.set(node.id, { progress: 0, weight });
    }

    return progress;
};
