import { XYPosition } from 'reactflow';

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
