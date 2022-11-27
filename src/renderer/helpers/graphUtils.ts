import { Position, XYPosition } from 'reactflow';

export interface Line {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
}

// From https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
// Modified by me
// returns true if the line from (a,b)->(c,d) intersects with (p,q)->(r,s)
export const intersects = (a: Line, b: Line) => {
    const det =
        (a.targetX - a.sourceX) * (b.targetY - b.sourceY) -
        (b.targetX - b.sourceX) * (a.targetY - a.sourceY);
    if (det === 0) {
        return false;
    }
    const lambda =
        ((b.targetY - b.sourceY) * (b.targetX - a.sourceX) +
            (b.sourceX - b.targetX) * (b.targetY - a.sourceY)) /
        det;
    const gamma =
        ((a.sourceY - a.targetY) * (b.targetX - a.sourceX) +
            (a.targetX - a.sourceX) * (b.targetY - a.sourceY)) /
        det;
    return lambda > 0 && lambda < 1 && gamma > 0 && gamma < 1;
};

// https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
// Modified by me
export const pDistance = (point: XYPosition, line: Line) => {
    const A = point.x - line.sourceX;
    const B = point.y - line.sourceY;
    const C = line.targetX - line.sourceX;
    const D = line.targetY - line.sourceY;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0)
        // in case of 0 length line
        param = dot / lenSq;

    let xx;
    let yy;

    if (param < 0) {
        xx = line.sourceX;
        yy = line.sourceY;
    } else if (param > 1) {
        xx = line.targetX;
        yy = line.targetY;
    } else {
        xx = line.sourceX + param * C;
        yy = line.sourceY + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
};

// Modified from https://github.com/wbkd/react-flow/blob/674127a3eb6d2a70ca5894dffa7c5bad9d9769d5/packages/core/src/components/Edges/BezierEdge.tsx

export interface GetBezierPathParams {
    sourceX: number;
    sourceY: number;
    sourcePosition?: Position;
    targetX: number;
    targetY: number;
    targetPosition?: Position;
    curvature?: number;
}

interface GetControlWithCurvatureParams {
    pos: Position;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    c: number;
}

const calculateControlOffset = (distance: number, curvature: number): number => {
    if (distance >= 0) {
        return 0.5 * distance;
    }

    return curvature * 25 * Math.sqrt(-distance);
};

const getControlWithCurvature = ({
    pos,
    x1,
    y1,
    x2,
    y2,
    c,
}: GetControlWithCurvatureParams): [number, number] => {
    switch (pos) {
        case Position.Left:
            return [x1 - calculateControlOffset(x1 - x2, c), y1];
        case Position.Right:
            return [x1 + calculateControlOffset(x2 - x1, c), y1];
        case Position.Top:
            return [x1, y1 - calculateControlOffset(y1 - y2, c)];
        case Position.Bottom:
            return [x1, y1 + calculateControlOffset(y2 - y1, c)];
        default:
            return [0, 0];
    }
};

export const getBezierPathValues = ({
    sourceX,
    sourceY,
    sourcePosition = Position.Bottom,
    targetX,
    targetY,
    targetPosition = Position.Top,
    curvature = 0.25,
}: GetBezierPathParams): [
    sourceX: number,
    sourceY: number,
    sourceControlX: number,
    sourceControlY: number,
    targetControlX: number,
    targetControlY: number,
    targetX: number,
    targetY: number
] => {
    const [sourceControlX, sourceControlY] = getControlWithCurvature({
        pos: sourcePosition,
        x1: sourceX,
        y1: sourceY,
        x2: targetX,
        y2: targetY,
        c: curvature,
    });
    const [targetControlX, targetControlY] = getControlWithCurvature({
        pos: targetPosition,
        x1: targetX,
        y1: targetY,
        x2: sourceX,
        y2: sourceY,
        c: curvature,
    });

    return [
        sourceX,
        sourceY,
        sourceControlX,
        sourceControlY,
        targetControlX,
        targetControlY,
        targetX,
        targetY,
    ];
};
