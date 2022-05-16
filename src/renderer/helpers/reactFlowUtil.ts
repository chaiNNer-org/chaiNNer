import { Node, XYPosition } from 'react-flow-renderer';
import { Mutable, NodeData } from '../../common/common-types';
import { deepCopy } from '../../common/util';

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
