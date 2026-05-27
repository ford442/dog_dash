import * as THREE from 'three';

export interface TetherSystemOptions {
    /** Maximum distance at which the tether can latch onto an anchor. Default: 60 */
    maxRange?: number;
    /** Spring pull-force magnitude applied per second while latched. Default: 18 */
    pullStrength?: number;
    /** Cooldown in seconds after releasing before the tether can be used again. Default: 3 */
    cooldown?: number;
    /** Base sling velocity impulse applied on release. Default: 20 */
    slingImpulse?: number;
    /** Called when the tether successfully latches onto an anchor. */
    onLatch?: (anchorPos: THREE.Vector3) => void;
    /** Called when the tether is released. Receives the computed sling impulse vector. */
    onRelease?: (impulse: THREE.Vector3) => void;
    /** Called when the post-release cooldown expires. */
    onCooldownEnd?: () => void;
}

export enum TetherState {
    IDLE = 'IDLE',
    LATCHED = 'LATCHED',
    COOLDOWN = 'COOLDOWN'
}

/**
 * TetherSystem — Player-controlled grapple / sling mechanic.
 *
 * Modelled after BoostSystem and RollSystem.  The caller is responsible for:
 *   1. Calling `activate(anchors, playerPos)` when the player presses the
 *      tether key/button.
 *   2. Calling `release(playerPos)` when the key/button is released.
 *   3. Calling `update(delta, playerPos)` every frame and adding the returned
 *      force vector to `playerState.currentSpeedY` (Y component).
 *
 * The system manages a THREE.Line beam visual internally; it must be
 * constructed with the active THREE.Scene so it can add/remove the beam.
 */
export class TetherSystem {
    // --- State ---
    private state: TetherState = TetherState.IDLE;
    private cooldownTimer: number = 0;
    private latchTimer: number = 0;
    private anchorPos: THREE.Vector3 | null = null;
    private anchorTarget: THREE.Object3D | null = null;

    // --- Config ---
    readonly maxRange: number;
    readonly cooldown: number;
    private readonly pullStrength: number;
    private readonly slingImpulse: number;

    // --- Visuals ---
    private beamLine: THREE.Line | null = null;
    private readonly scene: THREE.Scene;

    // --- Callbacks ---
    private readonly onLatch?: (anchorPos: THREE.Vector3) => void;
    private readonly onRelease?: (impulse: THREE.Vector3) => void;
    private readonly onCooldownEnd?: () => void;

    constructor(scene: THREE.Scene, options: TetherSystemOptions = {}) {
        this.scene = scene;
        this.maxRange = options.maxRange ?? 60;
        this.pullStrength = options.pullStrength ?? 18;
        this.cooldown = options.cooldown ?? 3;
        this.slingImpulse = options.slingImpulse ?? 20;
        this.onLatch = options.onLatch;
        this.onRelease = options.onRelease;
        this.onCooldownEnd = options.onCooldownEnd;

        this._createBeam();
    }

    // -------------------------------------------------------------------------
    // State queries
    // -------------------------------------------------------------------------

    isLatched(): boolean { return this.state === TetherState.LATCHED; }
    isOnCooldown(): boolean { return this.state === TetherState.COOLDOWN; }
    canTether(): boolean { return this.state === TetherState.IDLE; }

    /** 0 → cooldown just started, 1 → cooldown fully expired (ready). */
    getCooldownRatio(): number {
        return this.state === TetherState.COOLDOWN
            ? 1 - (this.cooldownTimer / this.cooldown)
            : (this.state === TetherState.IDLE ? 1 : 0);
    }

    /** Position of the currently latched anchor, or null if not latched. */
    getAnchorPosition(): THREE.Vector3 | null {
        return this.anchorTarget?.position ?? this.anchorPos;
    }

    /** Currently latched tether target, if any. */
    getLatchedTarget(): THREE.Object3D | null { return this.anchorTarget; }

    /** How many seconds the tether has been held since the last latch. */
    getLatchDuration(): number { return this.latchTimer; }

    // -------------------------------------------------------------------------
    // Activate — latch onto the nearest tetherable anchor within range
    // -------------------------------------------------------------------------

    /**
     * Attempts to latch the tether to the nearest `tetherable` anchor.
     * @returns true if a latch was established, false otherwise.
     */
    activate(anchors: THREE.Object3D[], playerPos: THREE.Vector3): boolean {
        if (!this.canTether()) return false;

        let nearest: THREE.Object3D | null = null;
        let nearestDist = this.maxRange;

        for (const anchor of anchors) {
            if (!anchor.userData.tetherable) continue;
            const dist = anchor.position.distanceTo(playerPos);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = anchor;
            }
        }

        if (!nearest) return false;

        this.state = TetherState.LATCHED;
        this.anchorTarget = nearest;
        this.anchorPos = nearest.position.clone();
        this.latchTimer = 0;

        this._showBeam(playerPos, nearest.position);
        this.onLatch?.(nearest.position.clone());
        return true;
    }

    // -------------------------------------------------------------------------
    // Release — compute sling impulse and begin cooldown
    // -------------------------------------------------------------------------

    /**
     * Releases the tether and returns a sling impulse vector that the caller
     * should add to the player velocity.  Returns a zero vector if not latched.
     */
    release(playerPos: THREE.Vector3): THREE.Vector3 {
        const anchorPosition = this.anchorTarget?.position ?? this.anchorPos;
        if (this.state !== TetherState.LATCHED || !anchorPosition) {
            return new THREE.Vector3();
        }

        // Direction from anchor → player ("away" direction at release point)
        const awayDir = new THREE.Vector3()
            .subVectors(playerPos, anchorPosition)
            .normalize();

        // Scale the impulse by how long the tether was held (caps at 2×)
        const holdBonus = Math.min(this.latchTimer / 1.0, 2.0);
        const impulse = awayDir.multiplyScalar(this.slingImpulse * holdBonus);

        this.state = TetherState.COOLDOWN;
        this.cooldownTimer = this.cooldown;
        this.anchorPos = null;
        this.anchorTarget = null;
        this.latchTimer = 0;
        this._hideBeam();

        this.onRelease?.(impulse.clone());
        return impulse;
    }

    // -------------------------------------------------------------------------
    // Update — call every frame
    // -------------------------------------------------------------------------

    /**
     * Advances the tether state machine.  While latched, returns the spring
     * force vector (in world space) that the caller should add to the player's
     * vertical speed (use the `.y` component) and/or full velocity.
     *
     * @param delta      Seconds since last frame.
     * @param playerPos  Current world-space player position.
     * @returns Spring force to apply this frame (zero when not latched).
     */
    update(delta: number, playerPos: THREE.Vector3): THREE.Vector3 {
        const force = new THREE.Vector3();

        const anchorPosition = this.anchorTarget?.position ?? this.anchorPos;
        if (this.state === TetherState.LATCHED && anchorPosition) {
            this.latchTimer += delta;

            // Spring: pull player toward anchor
            const direction = new THREE.Vector3()
                .subVectors(anchorPosition, playerPos)
                .normalize();
            force.copy(direction).multiplyScalar(this.pullStrength * delta);

            // Keep beam visual up-to-date
            this._updateBeam(playerPos, anchorPosition);

            // Animate beam opacity to pulse while latched
            if (this.beamLine) {
                const mat = this.beamLine.material as THREE.LineBasicMaterial;
                mat.opacity = 0.6 + Math.sin(this.latchTimer * 8) * 0.25;
            }
        }

        if (this.state === TetherState.COOLDOWN) {
            this.cooldownTimer -= delta;
            if (this.cooldownTimer <= 0) {
                this.cooldownTimer = 0;
                this.state = TetherState.IDLE;
                this.onCooldownEnd?.();
            }
        }

        return force;
    }

    // -------------------------------------------------------------------------
    // Beam visual helpers (private)
    // -------------------------------------------------------------------------

    private _createBeam(): void {
        const points = [new THREE.Vector3(), new THREE.Vector3()];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0x00ffcc,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.beamLine = new THREE.Line(geo, mat);
        this.beamLine.visible = false;
        this.scene.add(this.beamLine);
    }

    private _showBeam(from: THREE.Vector3, to: THREE.Vector3): void {
        if (!this.beamLine) return;
        this._updateBeam(from, to);
        this.beamLine.visible = true;
    }

    private _updateBeam(from: THREE.Vector3, to: THREE.Vector3): void {
        if (!this.beamLine) return;
        const pos = this.beamLine.geometry.attributes.position;
        pos.setXYZ(0, from.x, from.y, from.z);
        pos.setXYZ(1, to.x, to.y, to.z);
        pos.needsUpdate = true;
    }

    private _hideBeam(): void {
        if (this.beamLine) this.beamLine.visible = false;
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    dispose(): void {
        if (this.beamLine) {
            this.scene.remove(this.beamLine);
            this.beamLine.geometry.dispose();
            (this.beamLine.material as THREE.Material).dispose();
            this.beamLine = null;
        }
    }
}
