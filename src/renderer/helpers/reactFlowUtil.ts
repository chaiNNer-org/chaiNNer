import { Size } from 'electron/common';
import { Edge, Node, XYPosition } from 'reactflow';
import { EdgeData, InputData, Mutable, NodeData, NodeType } from '../../common/common-types';
import { SchemaMap } from '../../common/SchemaMap';
import { createUniqueId, deepCopy } from '../../common/util';

export const defaultIteratorSize: Readonly<Size> = { width: 1280, height: 720 };

export interface NodeProto {
    id?: string;
    position: Readonly<XYPosition>;
    data: Omit<NodeData, 'id' | 'inputData'> & { inputData?: InputData };
    nodeType: NodeType;
}

export const createNode = (
    { id = createUniqueId(), position, data, nodeType }: NodeProto,
    schemata: SchemaMap,
    parent?: Node<NodeData>,
    selected = false
): Node<NodeData>[] => {
    const newNode: Node<Mutable<NodeData>> = {
        type: nodeType,
        id,
        position: { ...position },
        data: {
            ...data,
            id,
            inputData: data.inputData ?? schemata.getDefaultInput(data.schemaId),
        },
        selected,
    };

    if (parent && parent.type === 'iterator' && nodeType !== 'iterator') {
        const { width, height, offsetTop, offsetLeft } = parent.data.iteratorSize ?? {
            ...defaultIteratorSize,
            offsetTop: 0,
            offsetLeft: 0,
        };
        newNode.position.x = position.x - parent.position.x;
        newNode.position.y = position.y - parent.position.y;
        newNode.parentNode = parent.id;
        newNode.data.parentNode = parent.id;
        newNode.extent = [
            [offsetLeft, offsetTop],
            [width, height],
        ];
    }

    const extraNodes: Node<NodeData>[] = [];
    if (nodeType === 'iterator') {
        newNode.data.iteratorSize = { ...defaultIteratorSize, offsetTop: 0, offsetLeft: 0 };

        const { defaultNodes = [] } = schemata.get(data.schemaId);

        defaultNodes.forEach(({ schemaId }) => {
            const schema = schemata.get(schemaId);
            const subNode = createNode(
                {
                    nodeType: schema.nodeType,
                    position: newNode.position,
                    data: {
                        schemaId,
                    },
                },
                schemata,
                newNode
            );
            extraNodes.push(...subNode);
        });
    }

    return [newNode, ...extraNodes];
};

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
export const withNewData = <K extends keyof NodeData>(
    node: Node<NodeData>,
    key: K,
    value: NodeData[K]
): Node<NodeData> => {
    if (node.data[key] === value) {
        return node;
    }
    return { ...node, data: { ...node.data, [key]: value } };
};
export const withNewDataMap = (node: Node<NodeData>, update: Partial<NodeData>): Node<NodeData> => {
    return { ...node, data: { ...node.data, ...update } };
};

export const setSelected = <T extends { selected?: boolean }>(
    selectable: readonly T[],
    selected: boolean
): T[] => selectable.map((s) => ({ ...s, selected }));

export const copyNodes = (
    nodesToCopy: readonly Node<NodeData>[],
    deriveNodeId: (oldId: string) => string,
    deriveParentNodeId: (parentOldId: string) => string | undefined,
    modifyPositions = true
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
                    x: n.position.x + (modifyPositions ? 200 + offsetX : 0),
                    y: n.position.y + (modifyPositions ? 200 + offsetY : 0),
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
                x: n.position.x + (modifyPositions ? offsetX : 0),
                y: n.position.y + (modifyPositions ? offsetY : 0),
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
