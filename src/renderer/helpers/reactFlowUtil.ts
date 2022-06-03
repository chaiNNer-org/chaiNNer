import { Edge, Node, XYPosition } from 'react-flow-renderer';
import { EdgeData, Mutable, NodeData } from '../../common/common-types';
import { createUniqueId, deepCopy } from '../../common/util';

export const snapToGrid = (
    position: Readonly<XYPosition>,
    snapToGridAmount: number
): XYPosition => ({
    x: position.x - (position.x % snapToGridAmount),
    y: position.y - (position.y % snapToGridAmount),
});

export const isSnappedToGrid = (
    position: Readonly<XYPosition>,
    snapToGridAmount: number
): boolean => position.x % snapToGridAmount === 0 && position.y % snapToGridAmount === 0;

export const copyNode = (node: Readonly<Node<NodeData>>): Node<Mutable<NodeData>> => deepCopy(node);

export const setSelected = <T extends { selected?: boolean }>(
    selectable: readonly T[],
    selected: boolean
): T[] => selectable.map((s) => ({ ...s, selected }));

export const copyNodes = (
    nodesToCopy: readonly Node<NodeData>[],
    deriveNodeId: (oldId: string) => string,
    deriveParentNodeId: (parentOldId: string) => string | undefined
): Mutable<Node<NodeData>>[] => {
    const offsetX = 50 * (Math.random() * 2 - 1);
    const offsetY = 50 * (Math.random() * 2 - 1);
    return nodesToCopy.map((n) => {
        const newId = deriveNodeId(n.id);
        if (!n.parentNode) {
            return {
                ...n,
                id: newId,
                position: {
                    x: n.position.x + 200 + offsetX,
                    y: n.position.y + 200 + offsetY,
                },
                data: {
                    ...n.data,
                    id: newId,
                },
                selected: false,
            };
        }

        const parentId = deriveParentNodeId(n.parentNode);
        const returnData: Mutable<Node<NodeData>> = {
            ...n,
            id: newId,
            position: {
                x: n.position.x + offsetX,
                y: n.position.y + offsetY,
            },
            data: {
                ...n.data,
                id: newId,
                parentNode: parentId,
            },
            parentNode: parentId,
            selected: false,
        };
        if (!parentId) {
            delete returnData.extent;
        }
        return returnData;
    });
};
export const copyEdges = (
    edgesToCopy: readonly Edge<EdgeData>[],
    deriveNodeId: (oldId: string) => string
): Mutable<Edge<EdgeData>>[] => {
    return edgesToCopy.map((e) => {
        let { source, sourceHandle, target, targetHandle } = e;
        source = deriveNodeId(source);
        sourceHandle = sourceHandle?.replace(e.source, source);
        target = deriveNodeId(target);
        targetHandle = targetHandle?.replace(e.target, target);

        return {
            ...e,
            id: createUniqueId(),
            source,
            sourceHandle,
            target,
            targetHandle,
            selected: false,
        };
    });
};

export const expandSelection = (
    nodes: readonly Node<NodeData>[],
    initialSelection: Iterable<string>
): Set<string> => {
    const selection = new Set(initialSelection);
    for (const n of nodes) {
        if (selection.has(n.parentNode!)) {
            selection.add(n.id);
        }
    }

    // remove iterator helper without their iterator
    for (const n of nodes) {
        if (n.type === 'iteratorHelper' && selection.has(n.id) && !selection.has(n.parentNode!)) {
            selection.delete(n.id);
        }
    }

    return selection;
};
