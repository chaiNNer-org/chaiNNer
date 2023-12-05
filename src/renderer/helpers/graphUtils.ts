import { Bezier } from 'bezier-js';
import ELK, { ElkNode } from 'elkjs';
import { Edge, Node, Position } from 'reactflow';
import { EdgeData, NodeData } from '../../common/common-types';
import { assertNever } from '../../common/util';

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
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    'elk.spacing.nodeNode': '80',
    'elk.direction': 'RIGHT',
};

export const getLayoutedPositionMap = async (nodes: Node<NodeData>[], edges: Edge<EdgeData>[]) => {
    const isHorizontal = elkOptions['elk.direction'] === 'RIGHT';
    const graph: ElkNode = {
        id: 'root',
        layoutOptions: elkOptions,
        children: nodes.map((node) => ({
            ...node,
            // Adjust the target and source handle positions based on the layout
            // direction.
            targetPosition: isHorizontal ? 'left' : 'top',
            sourcePosition: isHorizontal ? 'right' : 'bottom',

            width: node.width || 150,
            height: node.height || 50,
        })),
        edges: edges.map((edge) => ({
            ...edge,
            sources: [edge.source],
            targets: [edge.target],
        })),
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
        positionMap.set(n.id, { x: (n.x || 0) + offsetX, y: (n.y || 0) + offsetY });
    });

    return positionMap;
};
