import { Edge, Node, XYPosition } from 'reactflow';
import { EdgeData, InputData, Mutable, NodeData } from '../../common/common-types';
import { SchemaMap } from '../../common/SchemaMap';
import { createUniqueId, deepCopy } from '../../common/util';

export interface NodeProto {
    id?: string;
    position: Readonly<XYPosition>;
    data: Omit<NodeData, 'id' | 'inputData'> & { inputData?: InputData };
}

export const createNode = (
    { id = createUniqueId(), position, data }: NodeProto,
    schemata: SchemaMap,
    selected = false
): Node<NodeData> => {
    const schema = schemata.get(data.schemaId);

    const newNode: Node<Mutable<NodeData>> = {
        type: schema.kind,
        id,
        position: { ...position },
        data: {
            ...data,
            id,
            inputData: data.inputData ?? schemata.getDefaultInput(data.schemaId),
        },
        selected,
    };

    return newNode;
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
    modifyPositions = true
): Mutable<Node<NodeData>>[] => {
    const offsetX = 50 * (Math.random() * 2 - 1);
    const offsetY = 50 * (Math.random() * 2 - 1);
    return nodesToCopy.map((n) => {
        const newId = deriveNodeId(n.id);
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
