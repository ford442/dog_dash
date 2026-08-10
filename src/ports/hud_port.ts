/** HUD surfaces used by combat feedback and sling combo. */
export interface HudPort {
    showSlingCombo(combo: number, isSurge?: boolean): void;
    hideSlingCombo(): void;
    addScore?(points: number): void;
}
