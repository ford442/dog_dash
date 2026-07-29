/**
 * Galactic Core / Accretion Disk — finale background set-piece (future-plan §10).
 *
 * A massive, slowly spinning singularity parked deep in the background with a
 * glowing accretion disk, a photon halo, and a swirl veil that fakes mild
 * gravitational lensing. Everything is additive + unlit and lives on a single
 * parallax group, so the cost is a handful of draw calls regardless of level
 * length.
 *
 * Gameplay hooks are deliberately small (this is a backdrop, not a boss):
 *  - `getProjectilePull()` bends plasma bolts that fly near the core.
 *  - `getStarfieldWarp()` reports how strongly parallax layers should smear.
 *  - `getApproachIntensity()` ramps 0→1 as the player closes in, so the loop can
 *    swell audio / juice without duplicating the distance math.
 *
 * Deferred-loaded via `level_systems_loader` when a level declares
 * `environments.galacticCore`, so levels 1–5 never pay for the chunk.
 */

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    time,
    uv,
    vec2,
    vec3,
    vec4,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    length,
    smoothstep,
    positionLocal
} from 'three/tsl';
import { decorationBudget } from './decoration_budget';

/**
 * Level-config payload (see `LevelEnvironments.galacticCore`).
 *
 * The core is a camera-relative parallax backdrop, not a world-anchored prop:
 * it sits `offsetX` ahead of the camera at depth `z`, and the approach ramp
 * (driven by the player's world X between `approachStartX` and `approachEndX`)
 * walks both values from their "start" to their "end" pair. That is what makes
 * the finale read as a slow fall toward something enormous.
 */
export type GalacticCoreConfig = {
    enabled: boolean;
    /** World X where the approach begins (ramp = 0). */
    approachStartX?: number;
    /** World X where the approach completes (ramp = 1). */
    approachEndX?: number;
    /** Camera-relative X offset at ramp 0 / ramp 1. */
    startOffsetX?: number;
    endOffsetX?: number;
    /** Depth at ramp 0 / ramp 1 (more negative = further away). */
    startZ?: number;
    endZ?: number;
    baseY?: number;
    /** Uniform scale on the whole set-piece (1 = ~150 unit disk radius). */
    scale?: number;
    /** Disk brightness multiplier (0.6–1.6 is the readable band). */
    intensity?: number;
    /** Inner disk colour (hot side). */
    innerColor?: number;
    /** Outer disk colour (cool side). */
    outerColor?: number;
};

const EVENT_HORIZON_RADIUS = 26;
const DISK_INNER_RADIUS = 34;
const DISK_OUTER_RADIUS = 150;
const HALO_OUTER_RADIUS = 44;
const VEIL_RADIUS = 190;
/** Projectiles only feel the core inside this radius (gameplay toy, not GR). */
const PROJECTILE_PULL_RADIUS = 240;
const PROJECTILE_PULL_STRENGTH = 5.5;

function useLiteMaterials(): boolean {
    return typeof window !== 'undefined' && window.usingWebGL === true;
}

/**
 * Accretion disk: layered radial + angular noise scrolling against the disk's
 * own rotation, masked to a ring and tinted from hot core to cool rim.
 */
function createDiskMaterial(
    intensityUniform: ReturnType<typeof uniform>,
    innerColor: number,
    outerColor: number
): THREE.Material {
    if (useLiteMaterials()) {
        // WebGL2 fallback: no node graph, just a soft additive ring.
        return new THREE.MeshBasicMaterial({
            color: innerColor,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
    }

    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    const pos = positionLocal.xy;
    const dist = length(pos);
    const normalizedDist = dist
        .sub(DISK_INNER_RADIUS)
        .div(DISK_OUTER_RADIUS - DISK_INNER_RADIUS);

    // Counter-rotate the sampling frame so the billow reads as orbital motion.
    const spin = time.mul(0.18);
    const c = cos(spin);
    const s = sin(spin);
    const rotated = vec2(
        pos.x.mul(c).sub(pos.y.mul(s)),
        pos.x.mul(s).add(pos.y.mul(c))
    );
    const angle = rotated.y.atan2(rotated.x);

    // Three octaves of cheap sine noise — enough billow without a texture.
    const band1 = sin(normalizedDist.mul(14.0).sub(time.mul(1.6)));
    const band2 = sin(normalizedDist.mul(38.0).add(time.mul(2.4)));
    const swirl1 = sin(angle.mul(7.0).add(normalizedDist.mul(9.0)).sub(time.mul(1.1)));
    const swirl2 = cos(angle.mul(15.0).sub(normalizedDist.mul(4.0)).add(time.mul(1.9)));
    const billow = band1
        .mul(0.35)
        .add(band2.mul(0.2))
        .add(swirl1.mul(0.3))
        .add(swirl2.mul(0.15))
        .mul(0.5)
        .add(0.55);

    const innerFade = smoothstep(0.0, 0.08, normalizedDist);
    const outerFade = smoothstep(0.72, 1.0, normalizedDist).oneMinus();
    const diskMask = innerFade.mul(outerFade);

    const hot = color(0xffffff);
    const mid = color(innerColor);
    const rim = color(outerColor);
    const tint = mix(
        mix(hot, mid, smoothstep(0.0, 0.35, normalizedDist)),
        rim,
        smoothstep(0.35, 0.85, normalizedDist)
    );

    const intensity = float(0.55).add(intensityUniform.mul(0.9));
    mat.colorNode = vec4(
        tint.mul(float(1.2).add(billow.mul(0.8))).mul(intensity),
        billow.mul(diskMask).pow(1.4).mul(intensity)
    );

    return mat;
}

/** Photon halo hugging the event horizon; brightens on approach. */
function createHaloMaterial(
    intensityUniform: ReturnType<typeof uniform>,
    tintColor: number
): THREE.Material {
    if (useLiteMaterials()) {
        return new THREE.MeshBasicMaterial({
            color: tintColor,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false
    });

    const dist = length(positionLocal.xy);
    const normalizedDist = dist
        .sub(EVENT_HORIZON_RADIUS)
        .div(HALO_OUTER_RADIUS - EVENT_HORIZON_RADIUS);

    const ring = smoothstep(0.0, 0.12, normalizedDist)
        .mul(smoothstep(0.12, 1.0, normalizedDist).oneMinus());
    const shimmer = sin(time.mul(1.4)).mul(0.12).add(1.0);
    const alpha = ring.mul(0.85).mul(shimmer).mul(float(0.5).add(intensityUniform.mul(0.8)));

    mat.colorNode = vec4(color(tintColor), alpha);
    return mat;
}

/**
 * Swirl veil: a wide, very faint disc whose UVs spiral inward. Read against the
 * starfield it approximates lensing smear without any postprocessing pass.
 */
function createVeilMaterial(intensityUniform: ReturnType<typeof uniform>): THREE.Material {
    if (useLiteMaterials()) {
        return new THREE.MeshBasicMaterial({
            color: 0x223355,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false
    });

    const centered = uv().sub(0.5);
    const r = length(centered).mul(2.0); // 0 at centre, 1 at rim
    const theta = centered.y.atan2(centered.x);

    // Spiral arms tighten toward the horizon — the "bend" cue.
    const spiral = sin(theta.mul(2.0).add(r.mul(-9.0)).add(time.mul(0.5)));
    const falloff = smoothstep(1.0, 0.15, r).mul(smoothstep(0.05, 0.2, r));
    const alpha = spiral
        .mul(0.5)
        .add(0.5)
        .mul(falloff)
        .mul(0.28)
        .mul(float(0.35).add(intensityUniform.mul(0.65)));

    mat.colorNode = vec4(mix(color(0x6688ff), color(0xffccee), r), alpha);
    return mat;
}

export class GalacticCoreSystem {
    readonly scene: THREE.Scene;
    active = false;

    readonly group: THREE.Group;
    private readonly eventHorizon: THREE.Mesh;
    private readonly disk: THREE.Mesh;
    private readonly halo: THREE.Mesh;
    private readonly veil: THREE.Mesh;

    private approachStartX = 4200;
    private approachEndX = 5200;
    private startOffsetX = 320;
    private endOffsetX = 95;
    private startZ = -1150;
    private endZ = -470;
    private baseY = 90;
    private intensityScale = 1.0;

    private readonly intensityUniform = uniform(0.0);
    private approach = 0;
    private elapsed = 0;

    constructor(scene: THREE.Scene, config?: GalacticCoreConfig) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.renderOrder = -20;

        const innerColor = config?.innerColor ?? 0xffb066;
        const outerColor = config?.outerColor ?? 0x7733aa;

        this.eventHorizon = new THREE.Mesh(
            new THREE.SphereGeometry(EVENT_HORIZON_RADIUS, useLiteMaterials() ? 20 : 40, useLiteMaterials() ? 16 : 32),
            new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })
        );

        this.disk = new THREE.Mesh(
            new THREE.RingGeometry(
                DISK_INNER_RADIUS,
                DISK_OUTER_RADIUS,
                useLiteMaterials() ? 48 : 96,
                1
            ),
            createDiskMaterial(this.intensityUniform, innerColor, outerColor)
        );
        this.disk.rotation.x = -Math.PI * 0.42;
        this.disk.rotation.y = Math.PI * 0.08;
        this.disk.position.z = -2;

        this.halo = new THREE.Mesh(
            new THREE.RingGeometry(EVENT_HORIZON_RADIUS, HALO_OUTER_RADIUS, useLiteMaterials() ? 32 : 64),
            createHaloMaterial(this.intensityUniform, innerColor)
        );
        this.halo.position.z = 1;

        this.veil = new THREE.Mesh(
            new THREE.PlaneGeometry(VEIL_RADIUS * 2, VEIL_RADIUS * 2),
            createVeilMaterial(this.intensityUniform)
        );
        this.veil.position.z = -4;

        this.group.add(this.veil, this.disk, this.eventHorizon, this.halo);
        this.group.visible = false;
        this.group.frustumCulled = false;
        scene.add(this.group);

        decorationBudget.register('galactic_core', {
            label: 'Galactic core (background)',
            category: 'background3d',
            maxActive: 1
        });
    }

    activate(config?: GalacticCoreConfig): void {
        if (config?.approachStartX !== undefined) this.approachStartX = config.approachStartX;
        if (config?.approachEndX !== undefined) this.approachEndX = config.approachEndX;
        if (config?.startOffsetX !== undefined) this.startOffsetX = config.startOffsetX;
        if (config?.endOffsetX !== undefined) this.endOffsetX = config.endOffsetX;
        if (config?.startZ !== undefined) this.startZ = config.startZ;
        if (config?.endZ !== undefined) this.endZ = config.endZ;
        if (config?.baseY !== undefined) this.baseY = config.baseY;
        if (config?.intensity !== undefined) this.intensityScale = config.intensity;
        if (config?.scale !== undefined) this.group.scale.setScalar(config.scale);

        if (this.active) return;
        this.active = true;
        this.group.visible = true;
        decorationBudget.syncCount('galactic_core', 1);
    }

    deactivate(): void {
        if (!this.active) return;
        this.active = false;
        this.group.visible = false;
        this.approach = 0;
        this.intensityUniform.value = 0;
        decorationBudget.syncCount('galactic_core', 0);
    }

    /** 0 (far away) → 1 (right on top of the core). */
    getApproachIntensity(): number {
        return this.approach;
    }

    /** How hard parallax layers should smear toward the core (0–1). */
    getStarfieldWarp(): number {
        return this.active ? this.approach * 0.6 : 0;
    }

    getCorePosition(): THREE.Vector3 {
        return this.group.position;
    }

    /**
     * Mild lensing for plasma bolts flying near the core: a perpendicular-ish
     * nudge toward the singularity that scales with proximity. Returns the
     * velocity delta for this frame (caller adds it).
     */
    getProjectilePull(projectilePos: THREE.Vector3, delta: number, out = new THREE.Vector3()): THREE.Vector3 {
        out.set(0, 0, 0);
        if (!this.active) return out;

        const core = this.group.position;
        const dx = core.x - projectilePos.x;
        const dy = core.y - projectilePos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > PROJECTILE_PULL_RADIUS || dist < 1) return out;

        const falloff = 1 - dist / PROJECTILE_PULL_RADIUS;
        const strength = PROJECTILE_PULL_STRENGTH * falloff * falloff * delta;
        out.set((dx / dist) * strength, (dy / dist) * strength, 0);
        return out;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3): void {
        if (!this.active) return;

        this.elapsed += delta;

        const referenceX = playerPos?.x ?? cameraX;
        const span = Math.max(1, this.approachEndX - this.approachStartX);
        const raw = THREE.MathUtils.clamp((referenceX - this.approachStartX) / span, 0, 1);
        // Ease-in so the swell lands on the final stretch instead of creeping.
        this.approach = raw * raw;
        this.intensityUniform.value = this.approach * this.intensityScale;

        // Camera-relative parallax: the core drifts in and forward as the ramp
        // climbs, so it grows on screen without ever entering the playfield.
        const offsetX = THREE.MathUtils.lerp(this.startOffsetX, this.endOffsetX, this.approach);
        const z = THREE.MathUtils.lerp(this.startZ, this.endZ, this.approach);
        this.group.position.set(
            cameraX + offsetX,
            this.baseY + Math.sin(this.elapsed * 0.08) * 4,
            z
        );

        // Lazy tumble on the disk so the silhouette keeps changing.
        this.disk.rotation.z = this.elapsed * 0.05;
        this.disk.rotation.x = -Math.PI * 0.42 + Math.sin(this.elapsed * 0.12) * 0.04;
        this.veil.rotation.z = -this.elapsed * 0.02;
    }

    cleanup(): void {
        this.scene.remove(this.group);
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                const mat = child.material;
                if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                else mat.dispose();
            }
        });
        decorationBudget.syncCount('galactic_core', 0);
    }
}
