import { XYPosition } from 'react-flow-renderer';

// eslint-disable-next-line import/prefer-default-export
export const snapToGrid = (
    position: Readonly<XYPosition>,
    snapToGridAmount: number
): XYPosition => ({
    x: position.x - (position.x % snapToGridAmount),
    y: position.y - (position.y % snapToGridAmount),
});
