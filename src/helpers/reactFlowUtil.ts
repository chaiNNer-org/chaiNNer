import { XYPosition } from 'react-flow-renderer';

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
