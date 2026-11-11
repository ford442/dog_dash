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

/**
 * Beyond this per-step jump the interpolator snaps instead of blending — a
 * pooled projectile reused at a new muzzle position, or a boss teleport,
 * must not streak across the screen for one frame.
 */
export const DEFAULT_SNAP_DISTANCE = 8;

interface TrackedEntry {
    readonly previous: THREE.Vector3;
    readonly current: THREE.Vector3;
    /** True sim position, saved while the blended pose is drawn. */
    readonly saved: THREE.Vector3;
    seenStep: number;
}

/**
 * Render interpolation for a changing set of sim-driven objects (plasma
 * bolts, slingables, the boss). Same contract as PositionInterpolator, but
 * keyed by Object3D: call beginStep() / record() for every live object /
 * endStep() once per fixed step, then applyBlend() right before the draw
 * and restore() right after it.
 *
 * Objects not recorded in the latest step are forgotten, so a pooled object
 * that goes inactive and is later respawned starts fresh at its new spot
 * rather than blending from where it died.
 */
export class ObjectInterpolator {
    private readonly entries = new Map<THREE.Object3D, TrackedEntry>();
    private readonly blended: TrackedEntry[] = [];
    private readonly blendedObjects: THREE.Object3D[] = [];
    private step = 0;

    constructor(private readonly snapDistance = DEFAULT_SNAP_DISTANCE) {}

    beginStep(): void {
        this.step++;
    }

    record(object: THREE.Object3D): void {
        const position = object.position;
        let entry = this.entries.get(object);
        if (!entry) {
            entry = {
                previous: position.clone(),
                current: position.clone(),
                saved: new THREE.Vector3(),
                seenStep: this.step
            };
            this.entries.set(object, entry);
            return;
        }
        if (entry.current.distanceToSquared(position) > this.snapDistance * this.snapDistance) {
            entry.previous.copy(position);
        } else {
            entry.previous.copy(entry.current);
        }
        entry.current.copy(position);
        entry.seenStep = this.step;
    }

    endStep(): void {
        for (const [object, entry] of this.entries) {
            if (entry.seenStep !== this.step) this.entries.delete(object);
        }
    }

    /** Writes the blended pose into each tracked object's position. Pair with restore(). */
    applyBlend(alpha: number): void {
        const a = Math.min(1, Math.max(0, alpha));
        this.blended.length = 0;
        this.blendedObjects.length = 0;
        for (const [object, entry] of this.entries) {
            entry.saved.copy(object.position);
            object.position.lerpVectors(entry.previous, entry.current, a);
            this.blended.push(entry);
            this.blendedObjects.push(object);
        }
    }

    /** Puts the true end-of-step sim positions back after the draw. */
    restore(): void {
        for (let i = 0; i < this.blendedObjects.length; i++) {
            this.blendedObjects[i].position.copy(this.blended[i].saved);
        }
        this.blended.length = 0;
        this.blendedObjects.length = 0;
    }

    reset(): void {
        this.entries.clear();
        this.blended.length = 0;
        this.blendedObjects.length = 0;
    }

    size(): number {
        return this.entries.size;
    }
}
