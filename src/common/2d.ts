/* eslint-disable no-param-reassign */
import { isReadonlyArray } from './util';

export interface Point {
    readonly x: number;
    readonly y: number;
}

type Vec2Like = number | Point | Vec2;

export class Vec2 {
    readonly x: number;

    readonly y: number;

    constructor(all: number);
    constructor(x: number, y: number);
    constructor(x: number, y: number = x) {
        this.x = x;
        this.y = y;
    }

    static from(v: number | Point | readonly [number, number]): Vec2 {
        if (typeof v === 'number') {
            return new Vec2(v);
        }
        if (isReadonlyArray(v)) {
            return new Vec2(v[0], v[1]);
        }
        return new Vec2(v.x, v.y);
    }

    static direction(from: Point, to: Point): Vec2 {
        return new Vec2(to.x - from.x, to.y - from.y);
    }

    static readonly ZERO = new Vec2(0);

    static readonly ONE = new Vec2(1);

    static readonly INF = new Vec2(Infinity);

    static readonly NEG_INF = new Vec2(-Infinity);

    /**
     * Returns the length of the vector (`sqrt(x^2 + y^2)`).
     */
    get length(): number {
        return Math.hypot(this.x, this.y);
    }

    /**
     * Returns the angle of the vector interpreted as a direction (`atan2(y, x)`).
     */
    get angle(): number {
        return Math.atan2(this.y, this.x);
    }

    neg(): Vec2 {
        return new Vec2(-this.x, -this.y);
    }

    add(v: Vec2Like): Vec2 {
        if (typeof v === 'number') v = new Vec2(v);
        return new Vec2(this.x + v.x, this.y + v.y);
    }

    sub(v: Vec2Like): Vec2 {
        if (typeof v === 'number') v = new Vec2(v);
        return new Vec2(this.x - v.x, this.y - v.y);
    }

    mul(v: Vec2Like): Vec2 {
        if (typeof v === 'number') v = new Vec2(v);
        return new Vec2(this.x * v.x, this.y * v.x);
    }

    div(v: Vec2Like): Vec2 {
        if (typeof v === 'number') v = new Vec2(v);
        return new Vec2(this.x / v.x, this.y / v.x);
    }

    min(v: Vec2Like): Vec2 {
        if (typeof v === 'number') v = new Vec2(v);
        return new Vec2(Math.min(this.x, v.x), Math.min(this.y, v.y));
    }

    max(v: Vec2Like): Vec2 {
        if (typeof v === 'number') v = new Vec2(v);
        return new Vec2(Math.max(this.x, v.x), Math.max(this.y, v.y));
    }

    abs(): Vec2 {
        return new Vec2(Math.abs(this.x), Math.abs(this.y));
    }

    dist(p: Point): number {
        return Math.hypot(this.x - p.x, this.y - p.y);
    }

    static dist(p1: Point, p2: Point): number {
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
}

export class Circle {
    readonly center: Vec2;

    readonly radius: number;

    constructor(center: Vec2, radius: number) {
        this.center = center;
        this.radius = radius;
    }

    atAngle(angle: number): Vec2 {
        return new Vec2(
            this.center.x + this.radius * Math.cos(angle),
            this.center.y + this.radius * Math.sin(angle)
        );
    }

    translate(offset: Vec2Like): Circle {
        return new Circle(this.center.add(offset), this.radius);
    }

    translateX(offset: number): Circle {
        return new Circle(new Vec2(this.center.x + offset, this.center.y), this.radius);
    }

    translateY(offset: number): Circle {
        return new Circle(new Vec2(this.center.x, this.center.y + offset), this.radius);
    }
}

export class Line {
    readonly from: Vec2;

    readonly to: Vec2;

    constructor(from: Vec2, to: Vec2) {
        this.from = from;
        this.to = to;
    }

    intersects(other: Line): boolean {
        const { from, to } = this;
        const { from: from2, to: to2 } = other;
        const s1x = to.x - from.x;
        const s1y = to.y - from.y;
        const s2x = to2.x - from2.x;
        const s2y = to2.y - from2.y;
        const s = (-s1y * (from.x - from2.x) + s1x * (from.y - from2.y)) / (-s2x * s1y + s1x * s2y);
        const t = (s2x * (from.y - from2.y) - s2y * (from.x - from2.x)) / (-s2x * s1y + s1x * s2y);
        return s >= 0 && s <= 1 && t >= 0 && t <= 1;
    }
}
