import { Edge, Node, getIncomers, getOutgoers } from 'reactflow';
import { EdgeData, NodeData } from '../../common/common-types';

export const gatherDownstreamIteratorNodes = (
    node: Node<NodeData>,
    nodes: Node<NodeData>[],
    edges: Edge<EdgeData>[]
) => {
    const outgoers = getOutgoers(node, nodes, edges);
    const results = new Set<string>();
    for (const child of outgoers) {
        if (child.type === 'newIterator') {
            results.add(child.id);
        }
        for (const other of gatherDownstreamIteratorNodes(child, nodes, edges)) {
            results.add(other);
        }
    }
    return results;
};

export const gatherUpstreamIteratorNodes = (
    node: Node<NodeData>,
    nodes: Node<NodeData>[],
    edges: Edge<EdgeData>[]
) => {
    const incomers = getIncomers(node, nodes, edges);
    const results = new Set<string>();
    for (const parent of incomers) {
        if (parent.type === 'newIterator') {
            results.add(parent.id);
        }
        for (const other of gatherUpstreamIteratorNodes(parent, nodes, edges)) {
            results.add(other);
        }
    }
    return results;
};

export const gatherDownstreamNodes = (
    node: Node<NodeData>,
    nodes: Node<NodeData>[],
    edges: Edge<EdgeData>[]
) => {
    const outgoers = getOutgoers(node, nodes, edges);
    const results = new Set<string>();
    for (const child of outgoers) {
        results.add(child.id);
        for (const other of gatherDownstreamNodes(child, nodes, edges)) {
            results.add(other);
        }
    }
    return results;
};

export const gatherUpstreamNodes = (
    node: Node<NodeData>,
    nodes: Node<NodeData>[],
    edges: Edge<EdgeData>[]
) => {
    const incomers = getIncomers(node, nodes, edges);
    const results = new Set<string>();
    for (const parent of incomers) {
        results.add(parent.id);
        for (const other of gatherUpstreamNodes(parent, nodes, edges)) {
            results.add(other);
        }
    }
    return results;
};
