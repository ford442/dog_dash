const DEFAULT_GROUND_LEVEL = -50;

export function checkPlatformCollision(x: number, y: number, groundLevel = DEFAULT_GROUND_LEVEL, radius = 0.3) {
    if (y - radius <= groundLevel) {
        return { collided: true, groundY: groundLevel };
    }
    return { collided: false, groundY: null };
}
