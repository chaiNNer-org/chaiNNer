import { Bezier } from 'bezier-js';
import ELK, { ElkExtendedEdge, ElkNode } from 'elkjs';
import { Edge, Node, Position } from 'reactflow';
import { Circle, Point, Vec2 } from '../../common/2d';
import { EdgeData, NodeData } from '../../common/common-types';
import { assertNever } from '../../common/util';

export class AABB {
    readonly min: Vec2;

    readonly max: Vec2;

    private constructor(min: Vec2, max: Vec2) {
        this.min = min;
        this.max = max;
    }

    static fromPoints(...points: Vec2[]): AABB {
        const min = points.reduce((acc, p) => acc.min(p), Vec2.INF);
        const max = points.reduce((acc, p) => acc.max(p), Vec2.NEG_INF);
        return new AABB(min, max);
    }

    contains({ x, y }: Point): boolean {
        return this.min.x <= x && x <= this.max.x && this.min.y <= y && y <= this.max.y;
    }

    intersects(other: AABB): boolean {
        const min = this.min.max(other.min);
        const max = this.max.min(other.max);
        return min.x <= max.x && min.y <= max.y;
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
        const TL = this.min;
        const TR = { x: this.max.x, y: this.min.y };
        const BL = { x: this.min.x, y: this.max.y };
        const BR = this.max;

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
    source: Vec2;
    sourcePosition?: Position;
    target: Vec2;
    targetPosition?: Position;
    curvature?: number;
}

interface GetControlWithCurvatureParams {
    pos: Position;
    p1: Vec2;
    p2: Vec2;
    c: number;
}

const calculateControlOffset = (distance: number, curvature: number): number => {
    if (distance >= 0) {
        return 0.5 * distance;
    }

    return curvature * 25 * Math.sqrt(-distance);
};

const getControlWithCurvature = ({ pos, p1, p2, c }: GetControlWithCurvatureParams): Vec2 => {
    switch (pos) {
        case Position.Left:
            return p1.add({ x: -calculateControlOffset(p1.x - p2.x, c), y: 0 });
        case Position.Right:
            return p1.add({ x: +calculateControlOffset(p2.x - p1.x, c), y: 0 });
        case Position.Top:
            return p1.add({ x: 0, y: -calculateControlOffset(p1.y - p2.y, c) });
        case Position.Bottom:
            return p1.add({ x: 0, y: +calculateControlOffset(p2.y - p1.y, c) });
        default:
            return assertNever(pos);
    }
};

export const getBezierPathValues = ({
    source,
    sourcePosition = Position.Bottom,
    target,
    targetPosition = Position.Top,
    curvature = 0.25,
}: GetBezierPathParams): [source: Vec2, sourceControl: Vec2, targetControl: Vec2, target: Vec2] => {
    const sourceControl = getControlWithCurvature({
        pos: sourcePosition,
        p1: source,
        p2: target,
        c: curvature,
    });
    const targetControl = getControlWithCurvature({
        pos: targetPosition,
        p1: target,
        p2: source,
        c: curvature,
    });

    return [source, sourceControl, targetControl, target];
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

const getCustomControlWithCurvature = ({ pos, p1, p2, c }: GetControlWithCurvatureParams): Vec2 => {
    switch (pos) {
        case Position.Left:
            return p1.add({ x: -calculateCustomControlOffset(p1.x - p2.x, c), y: 0 });
        case Position.Right:
            return p1.add({ x: +calculateCustomControlOffset(p2.x - p1.x, c), y: 0 });
        case Position.Top:
            return p1.add({ x: 0, y: -calculateCustomControlOffset(p1.y - p2.y, c) });
        case Position.Bottom:
            return p1.add({ x: 0, y: +calculateCustomControlOffset(p2.y - p1.y, c) });
        default:
            return assertNever(pos);
    }
};

const getBezierEdgeCenter = ({
    source,
    target,
    sourceControl,
    targetControl,
}: {
    source: Vec2;
    target: Vec2;
    sourceControl: Vec2;
    targetControl: Vec2;
}): [Vec2, Vec2] => {
    // cubic bezier t=0.5 mid point, not the actual mid point, but easy to calculate
    // https://stackoverflow.com/questions/67516101/how-to-find-distance-mid-point-of-bezier-curve
    const center = source
        .mul(0.125)
        .add(sourceControl.mul(0.375))
        .add(targetControl.mul(0.375))
        .add(target.mul(0.125));
    const offset = center.sub(source).abs();

    return [center, offset];
};

export const getCustomBezierPath = ({
    source,
    sourcePosition = Position.Bottom,
    target,
    targetPosition = Position.Top,
    curvatures = {
        source: 0.25,
        target: 0.25,
    },
    radii,
}: {
    source: Vec2;
    sourcePosition?: Position;
    target: Vec2;
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
    let s = source;
    let t = target;
    const sourceCircle = new Circle(source, radii?.source ?? 0);
    const targetCircle = new Circle(target, radii?.target ?? 0);

    const { angle } = Vec2.direction(sourceCircle.center, targetCircle.center);

    if (radii?.source) {
        const sourcePoint = sourceCircle.atAngle(angle);
        s = new Vec2(sourcePoint.x - sourceCircle.radius, sourcePoint.y);
    }
    if (radii?.target) {
        const targetPoint = targetCircle.atAngle(angle + Math.PI);
        t = new Vec2(targetPoint.x + targetCircle.radius, targetPoint.y);
    }

    const sourceControl = getCustomControlWithCurvature({
        pos: sourcePosition,
        p1: s,
        p2: t,
        c: curvatures.source,
    });

    const targetControl = getCustomControlWithCurvature({
        pos: targetPosition,
        p1: t,
        p2: s,
        c: curvatures.target,
    });
    const [label, offset] = getBezierEdgeCenter({
        source: s,
        target: t,
        sourceControl,
        targetControl,
    });

    return [
        `M${s.x},${s.y} C${sourceControl.x},${sourceControl.y} ${targetControl.x},${targetControl.y} ${t.x},${t.y}`,
        label.x,
        label.y,
        offset.x,
        offset.y,
    ];
};

// Modify getEdgeParams to use circle parameters and get the line that floats around the edge of each circle
export const getCircularEdgeParams = (sourceCircle: Circle, targetCircle: Circle) => {
    // Update the sourceX and source Y to be in the center of the circle
    // eslint-disable-next-line no-param-reassign
    sourceCircle = sourceCircle.translateX(-sourceCircle.radius);
    // eslint-disable-next-line no-param-reassign
    targetCircle = targetCircle.translateX(targetCircle.radius);

    // Calculate the angle between the centers of the circles
    const { angle } = Vec2.direction(sourceCircle.center, targetCircle.center);

    // Calculate the points on the circumference of each circle based on the angle
    const startEdgePoint = sourceCircle.atAngle(angle);
    const endEdgePoint = targetCircle.atAngle(angle + Math.PI);

    return {
        s: startEdgePoint,
        t: endEdgePoint,
    };
};
