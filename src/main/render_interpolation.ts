import * as THREE from 'three';

/**
 * Tracks the last two authoritative simulation positions of a fast-moving
 * entity (the player) so the renderer can draw a blend between them instead
 * of snapping to the latest fixed-step position. This keeps a 60Hz sim from
 * looking worse than wall-clock movement on a high-refresh display.
 *
 * The sim keeps writing to the entity's real Object3D.position each fixed
 * step; callers should sample() before/after each step and only use
 * getInterpolated() to compute a transient render-only position.
 */
export class PositionInterpolator {
    private readonly previous = new THREE.Vector3();
    private readonly current = new THREE.Vector3();
    private readonly blended = new THREE.Vector3();
    private primed = false;

    /**
     * Call once after every fixed simulation step. Shifts `current` into
     * `previous` first, so after N steps in a frame `previous`/`current`
     * hold exactly the last two simulation states — never the state from
     * before the frame's whole catch-up run.
     */
    recordStep(position: THREE.Vector3): void {
        if (this.primed) {
            this.previous.copy(this.current);
        } else {
            this.previous.copy(position);
            this.primed = true;
        }
        this.current.copy(position);
    }

    reset(): void {
        this.primed = false;
    }

    hasSample(): boolean {
        return this.primed;
    }

    /** Blend of the last two recorded positions; alpha is clamped to [0, 1]. */
    getInterpolated(alpha: number): THREE.Vector3 | null {
        if (!this.primed) return null;
        const a = Math.min(1, Math.max(0, alpha));
        return this.blended.lerpVectors(this.previous, this.current, a);
    }
}
