export function checkPlatformCollision(x: number, y: number, groundLevel: number, radius = 0.3) {
    if (y - radius <= groundLevel) {
        return { collided: true, groundY: groundLevel };
    }
    return { collided: false, groundY: null };
}
