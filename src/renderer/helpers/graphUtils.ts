import { Bezier } from 'bezier-js';
import ELK, { ElkExtendedEdge, ElkNode } from 'elkjs';
import { Edge, Node, Position } from 'reactflow';
import { EdgeData, NodeData } from '../../common/common-types';
import { assertNever } from '../../common/util';
import { Circle, getAngleBetweenPoints, getPointOnCircle } from './floatingEdgeUtils';

export interface Point {
    readonly x: number;
    readonly y: number;
}

export const pointDist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export class AABB {
    readonly min: Point;

    readonly max: Point;

    private constructor(min: Point, max: Point) {
        this.min = min;
        this.max = max;
    }

    static fromPoints(...points: Point[]): AABB {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const { x, y } of points) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }

        return new AABB({ x: minX, y: minY }, { x: maxX, y: maxY });
    }

    contains({ x, y }: Point): boolean {
        return this.min.x <= x && x <= this.max.x && this.min.y <= y && y <= this.max.y;
    }

    intersects(other: AABB): boolean {
        const minX = Math.max(this.min.x, other.min.x);
        const minY = Math.max(this.min.y, other.min.y);
        const maxX = Math.min(this.max.x, other.max.x);
        const maxY = Math.min(this.max.y, other.max.y);
        return minX <= maxX && minY <= maxY;
    }

    intersectsCurve(curve: Bezier): boolean {
        // check if we contain either end point
        if (
            this.contains(curve.points[0]) ||
            this.contains(curve.points[curve.points.length - 1])
        ) {
            return true;
        }

        // check the side of the AABB
        const TL: Point = this.min;
        const TR: Point = { x: this.max.x, y: this.min.y };
        const BL: Point = { x: this.min.x, y: this.max.y };
        const BR: Point = this.max;

        return (
            curve.lineIntersects({ p1: TL, p2: TR }).length > 0 ||
            curve.lineIntersects({ p1: TR, p2: BR }).length > 0 ||
            curve.lineIntersects({ p1: BR, p2: BL }).length > 0 ||
            curve.lineIntersects({ p1: BL, p2: TL }).length > 0
        );
    }
}

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
            return assertNever(pos);
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

const elk = new ELK();

const elkOptions = {
    'elk.algorithm': 'layered',
    'elk.layered.wrapping.additionalEdgeSpacing': '0',
    'elk.spacing.componentComponent': '80',
    'elk.layered.spacing.nodeNodeBetweenLayers': '64',
    'elk.spacing.nodeNode': '32',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '0',
    'elk.layered.spacing.edgeNodeBetweenLayers': '0',
    'elk.spacing.edgeNode': '0',
    'elk.spacing.edgeEdge': '0',
    'elk.direction': 'RIGHT',
    'elk.edgeRouting': 'SPLINES',
    'elk.layered.thoroughness': '30',
};

export const getLayoutedPositionMap = async (
    nodes: Node<NodeData>[],
    edges: Edge<EdgeData>[],
    gridSize?: number
): Promise<Map<string, Point>> => {
    const alignToGrid = (n: number) => {
        if (!gridSize) return n;
        return Math.round(n / gridSize) * gridSize;
    };

    const options = { ...elkOptions };

    // set sizes to nearest multiple
    const sizeKeys = [
        'elk.spacing.componentComponent',
        'elk.layered.spacing.nodeNodeBetweenLayers',
        'elk.spacing.nodeNode',
    ] as const;
    for (const key of sizeKeys) {
        options[key] = alignToGrid(Number(options[key])).toString();
    }

    const graph: ElkNode = {
        id: 'root',
        layoutOptions: options,
        children: nodes.map((node): ElkNode => {
            return {
                id: node.id,
                width: alignToGrid(node.width || 240),
                height: alignToGrid(node.height || 50),
            };
        }),
        edges: edges.map((edge): ElkExtendedEdge => {
            return {
                id: edge.id,
                sources: [edge.source],
                targets: [edge.target],
            };
        }),
    };

    const layoutedGraph = await elk.layout(graph);
    const positionMap = new Map<string, Point>();
    const layoutedNodes = layoutedGraph.children || [];

    const minLayoutedX = Math.min(...layoutedNodes.map((n) => n.x ?? Infinity));
    const minLayoutedY = Math.min(...layoutedNodes.map((n) => n.y ?? Infinity));
    const minOriginalX = Math.min(...nodes.map((n) => n.position.x));
    const minOriginalY = Math.min(...nodes.map((n) => n.position.y));

    const offsetX = minOriginalX - minLayoutedX;
    const offsetY = minOriginalY - minLayoutedY;

    layoutedNodes.forEach((n) => {
        positionMap.set(n.id, {
            x: alignToGrid((n.x || 0) + offsetX),
            y: alignToGrid((n.y || 0) + offsetY),
        });
    });

    return positionMap;
};

const calculateCustomControlOffset = (distance: number, curvature: number): number => {
    return curvature * 25 * Math.sqrt(Math.abs(distance));
};

const getCustomControlWithCurvature = ({
    pos,
    x1,
    y1,
    x2,
    y2,
    c,
}: GetControlWithCurvatureParams): [number, number] => {
    switch (pos) {
        case Position.Left:
            return [x1 - calculateCustomControlOffset(x1 - x2, c), y1];
        case Position.Right:
            return [x1 + calculateCustomControlOffset(x2 - x1, c), y1];
        case Position.Top:
            return [x1, y1 - calculateCustomControlOffset(y1 - y2, c)];
        case Position.Bottom:
            return [x1, y1 + calculateCustomControlOffset(y2 - y1, c)];
        default:
            return assertNever(pos);
    }
};

export const getBezierEdgeCenter = ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    sourceControlY,
    targetControlX,
    targetControlY,
}: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourceControlX: number;
    sourceControlY: number;
    targetControlX: number;
    targetControlY: number;
}): [number, number, number, number] => {
    // cubic bezier t=0.5 mid point, not the actual mid point, but easy to calculate
    // https://stackoverflow.com/questions/67516101/how-to-find-distance-mid-point-of-bezier-curve
    const centerX =
        sourceX * 0.125 + sourceControlX * 0.375 + targetControlX * 0.375 + targetX * 0.125;
    const centerY =
        sourceY * 0.125 + sourceControlY * 0.375 + targetControlY * 0.375 + targetY * 0.125;
    const offsetX = Math.abs(centerX - sourceX);
    const offsetY = Math.abs(centerY - sourceY);

    return [centerX, centerY, offsetX, offsetY];
};

export const getCustomBezierPath = ({
    sourceX,
    sourceY,
    sourcePosition = Position.Bottom,
    targetX,
    targetY,
    targetPosition = Position.Top,
    curvatures = {
        source: 0.25,
        target: 0.25,
    },
    radii,
}: {
    sourceX: number;
    sourceY: number;
    sourcePosition?: Position;
    targetX: number;
    targetY: number;
    targetPosition?: Position;
    curvatures?: {
        source: number;
        target: number;
    };
    radii?: {
        source: number;
        target: number;
    };
}): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number] => {
    let sx = sourceX;
    let sy = sourceY;
    let tx = targetX;
    let ty = targetY;
    const sourceCircle: Circle = { x: sourceX, y: sourceY, radius: radii?.source ?? 0 };
    const targetCircle: Circle = { x: targetX, y: targetY, radius: radii?.target ?? 0 };

    const angle = getAngleBetweenPoints(sourceCircle, targetCircle);

    if (radii?.source) {
        const sourcePoint = getPointOnCircle(sourceCircle, angle);
        sx = sourcePoint.x - sourceCircle.radius;
        sy = sourcePoint.y;
    }
    if (radii?.target) {
        const targetPoint = getPointOnCircle(targetCircle, angle + Math.PI);
        tx = targetPoint.x + targetCircle.radius;
        ty = targetPoint.y;
    }

    const [sourceControlX, sourceControlY] = getCustomControlWithCurvature({
        pos: sourcePosition,
        x1: sx,
        y1: sy,
        x2: tx,
        y2: ty,
        c: curvatures.source,
    });

    const [targetControlX, targetControlY] = getCustomControlWithCurvature({
        pos: targetPosition,
        x1: tx,
        y1: ty,
        x2: sx,
        y2: sy,
        c: curvatures.target,
    });
    const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
        sourceX: sx,
        sourceY: sy,
        targetX: tx,
        targetY: ty,
        sourceControlX,
        sourceControlY,
        targetControlX,
        targetControlY,
    });

    return [
        `M${sx},${sy} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${tx},${ty}`,
        labelX,
        labelY,
        offsetX,
        offsetY,
    ];
};
