/** Player scroll speed and vertical clamp — used by dream portal and power-ups. */
export interface PlayerMotionPort {
    getScrollSpeed(): number;
    setScrollSpeed(speed: number): void;
    setWorldOriginY(y: number): void;
    nudgePlayer(dx: number, dy: number): void;
}
