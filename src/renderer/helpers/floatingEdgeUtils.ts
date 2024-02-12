export interface Circle {
    x: number;
    y: number;
    radius: number;
}

// Calculate the angle between two points in radians
export const getAngleBetweenPoints = (
    point1: { x: number; y: number },
    point2: { x: number; y: number }
) => {
    return Math.atan2(point2.y - point1.y, point2.x - point1.x);
};

// Calculate the point on the circumference of a circle given an angle
export const getPointOnCircle = (circle: Circle, angle: number) => {
    const x = circle.x + circle.radius * Math.cos(angle);
    const y = circle.y + circle.radius * Math.sin(angle);
    return { x, y };
};

// Modify getEdgeParams to use circle parameters and get the line that floats around the edge of each circle
export const getCircularEdgeParams = (sourceCircle: Circle, targetCircle: Circle) => {
    // Update the sourceX and source Y to be in the center of the circle
    // eslint-disable-next-line no-param-reassign
    sourceCircle.x -= sourceCircle.radius;
    // eslint-disable-next-line no-param-reassign
    targetCircle.x += targetCircle.radius;

    // Calculate the angle between the centers of the circles
    const angle = getAngleBetweenPoints(sourceCircle, targetCircle);

    // Calculate the points on the circumference of each circle based on the angle
    const startEdgePoint = getPointOnCircle(sourceCircle, angle);
    const endEdgePoint = getPointOnCircle(targetCircle, angle + Math.PI);

    return {
        sx: startEdgePoint.x,
        sy: startEdgePoint.y,
        tx: endEdgePoint.x,
        ty: endEdgePoint.y,
    };
};
