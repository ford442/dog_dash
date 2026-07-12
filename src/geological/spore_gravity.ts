import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { time, positionLocal, uniform, instanceIndex, vec3, sin, cos, float } from 'three/tsl';

// --- GPU SPORE CLOUD ---
export class SporeCloud {
    scene: THREE.Scene;
    spores: THREE.InstancedMesh;
    active: boolean = true;
    position: THREE.Vector3; // Center of cloud

    constructor(scene: THREE.Scene, position: THREE.Vector3, count: number) {
        this.scene = scene;
        this.position = position;

        // TSL-based material
        const material = new MeshBasicNodeMaterial({
            color: 0x88ff88,
            transparent: true,
            opacity: 0.8
        });

        const uTime = time;
        const uShockPos = uniform(new THREE.Vector3(0, 0, 0));
        const uShockStrength = uniform(0.0);

        // --- Vertex Animation ---
        // 1. Brownian Motion
        const idx = float(instanceIndex);
        const t = uTime.mul(0.5);

        // Pseudo-random offsets based on index and time
        const noiseX = sin(t.add(idx).mul(1.1)).add(cos(t.mul(0.7).add(idx.mul(2.0))));
        const noiseY = cos(t.add(idx.mul(1.5)).mul(1.2)).add(sin(t.mul(0.8).add(idx)));
        const noiseZ = sin(t.add(idx.mul(0.5)).mul(1.3)).add(cos(t.mul(0.9).add(idx.mul(3.0))));

        let motion = vec3(noiseX, noiseY, noiseZ).mul(0.05); // Small amplitude

        // 2. Shockwave Interaction
        // Use positionLocal (instance center approx) + motion to get animated position
        // We use positionLocal as a proxy for world position relative to cloud center if we assume cloud is at 0,0,0
        // But spores are placed at absolute world positions via instance matrix.
        // In TSL, `positionLocal` is the geometry vertex.
        // To get the world position of the instance, we need to rely on the fact that for spheres,
        // center is 0,0,0 in local space.
        // But the shader runs on vertices.
        // Let's use `modelWorldMatrix * vec4(0,0,0,1)` to get instance center?
        // TSL: `(modelWorldMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz`

        // Simplified: The shockwave affects the vertex based on its distance to shock center.
        // We need to transform uShockPos to local space?
        // Or just assume `positionLocal` + instance translation is what we care about.
        // Wait, TSL handles InstancedMesh automatically.
        // We will just use `distance(positionLocal, ...)` but `uShockPos` is World.

        // Let's try to pass `uShockPos` in Local Space of the cloud.
        // The cloud `spores` mesh is at (0,0,0) world usually if added to scene?
        // In constructor: `this.scene.add(this.spores);`
        // So mesh local space == world space (if scene is root).
        // Instances have their own transform.

        // IMPORTANT: In `MeshBasicNodeMaterial` for `InstancedMesh`:
        // `positionLocal` is the vertex position in the geometry (e.g. on the sphere surface).
        // The final position is `instanceMatrix * positionLocal`.

        // To interact properly, we need the World Position of the vertex.
        // We can get `positionWorld` (varying) but that's for fragment shader?
        // In vertex stage, we can construct it if needed.
        // However, a simple visual hack:
        // Use `distance(vec3(0.0), positionLocal)` -> always small (radius of spore).

        // Let's just implement a global "pulse" when hit, affecting all spores,
        // because calculating per-instance distance to a point without attributes is hard in pure TSL currently.
        // We will displace all particles outwards from their center based on noise to simulate agitation.

        const agitation = uShockStrength.mul(vec3(noiseX, noiseY, noiseZ).mul(2.0));
        motion = motion.add(agitation);

        // Apply motion to position
        material.positionNode = positionLocal.add(motion);

        // Store uniforms for JS access
        material.userData = {
            uShockPos,
            uShockStrength
        };

        // Create geometry
        const geometry = new THREE.SphereGeometry(0.1, 4, 4);

        this.spores = new THREE.InstancedMesh(geometry, material, count);
        this.spores.instanceMatrix.setUsage(THREE.StaticDrawUsage); // Static!
        this.spores.userData = { parentCloud: this };
        this.scene.add(this.spores);

        const dummy = new THREE.Object3D();

        // Initialize spores in a cloud shape
        for (let i = 0; i < count; i++) {
            // Random position within cloud radius
            const r = 5 * Math.cbrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const x = position.x + r * Math.sin(phi) * Math.cos(theta);
            const y = position.y + r * Math.sin(phi) * Math.sin(theta);
            const z = position.z + r * Math.cos(phi);

            dummy.position.set(x, y, z);
            dummy.updateMatrix();
            this.spores.setMatrixAt(i, dummy.matrix);
        }

        this.spores.instanceMatrix.needsUpdate = true;
    }

    update(delta: number) {
        // Decay shockwave strength
        const mat = this.spores.material as any;
        if (mat.userData && mat.userData.uShockStrength) {
            const current = mat.userData.uShockStrength.value;
            if (current > 0.01) {
                mat.userData.uShockStrength.value = current * 0.9; // Decay
            } else {
                mat.userData.uShockStrength.value = 0;
            }
        }
    }

    triggerChainReaction(hitPoint: THREE.Vector3) {
        const mat = this.spores.material as any;
        if (mat.userData && mat.userData.uShockStrength) {
            mat.userData.uShockStrength.value = 1.0; // Trigger agitation
            // Optionally update position if we were doing distance checks
            if (mat.userData.uShockPos) {
                mat.userData.uShockPos.value.copy(hitPoint);
            }
        }
        return 5;
    }
}

// =============================================================================
// 9. GRAVITY ANCHORS ("Stellar Cores") — Localized inverse-square force fields
// =============================================================================

// Physics constants — all tunable
const GA_FIELD_RADIUS = 40.0;   // Influence radius in world units
const GA_MASS = 500.0;           // Force constant (higher = stronger pull)
const GA_SOFTENING = 8.0;        // Softening distance to avoid singularity at close range
const GA_MAX_FORCE = 14.0;       // Max force magnitude per second (prevents runaway)
/** Exit velocity bonus (units/s) added to player Y-speed on a clean tangent sling. */
export const GA_SLING_BONUS = 14.0;

export interface GravityAnchorInteraction {
    /** Radial force vector already pre-multiplied by delta, ready to add to velocity. */
    force: THREE.Vector3;
    /** True while the player is inside the influence field. */
    isInfluencing: boolean;
    /** Set to true on the frame the player exits the field after a clean sling arc. */
    slungExit: boolean;
    /** Distance from player to anchor center this frame (0 when not influencing). */
    distance: number;
    /** Approximate angular speed of the player around the anchor (radians/s). */
    angularSpeed: number;
}

/** Per-biome visual identity for Gravity Anchors. */
interface GravityAnchorBiomeConfig {
    coreColor: number;
    coreEmissive: number;
    coreMetalness: number;
    coreRoughness: number;
    coreClearcoat: number;
    coreTransmission: number;
    glowColor: number;
    ringColors: number[];
    ringCount: number;
    inflowColor: number;
}

const GRAVITY_ANCHOR_BIOMES: { [biome: number]: GravityAnchorBiomeConfig } = {
    // 1 — The Neon Garden: soft organic jelly-star, fractal moss rings, spore inflow
    1: {
        coreColor:       0x44ff99,
        coreEmissive:    0x00ff66,
        coreMetalness:   0.0,
        coreRoughness:   0.05,
        coreClearcoat:   0.8,
        coreTransmission: 0.5,
        glowColor:       0x00ff88,
        ringColors:      [0x88ffcc, 0x44ff88, 0xaaffaa, 0x22dd66],
        ringCount:       4,
        inflowColor:     0x66ffaa
    },
    // 2 — The Asteroid Belt: dense rusted iron core, metallic debris rings, ember sparks
    2: {
        coreColor:       0x8b4513,
        coreEmissive:    0xff4400,
        coreMetalness:   0.9,
        coreRoughness:   0.55,
        coreClearcoat:   0.1,
        coreTransmission: 0.0,
        glowColor:       0xff6600,
        ringColors:      [0xcc6622, 0xaa4400, 0xff8833],
        ringCount:       3,
        inflowColor:     0xff6600
    },
    // 3 — Orbital Descent: heat-distorted crystal, re-entry flame trails
    3: {
        coreColor:       0x0088ff,
        coreEmissive:    0xff8800,
        coreMetalness:   0.1,
        coreRoughness:   0.0,
        coreClearcoat:   1.0,
        coreTransmission: 0.35,
        glowColor:       0xff8833,
        ringColors:      [0x00ccff, 0xff8800, 0xffcc00],
        ringCount:       3,
        inflowColor:     0xff9944
    },
    // 4 — The Rusty Gauntlet: industrial riveted well, warning strobe rings
    4: {
        coreColor:       0x443322,
        coreEmissive:    0xffaa00,
        coreMetalness:   0.95,
        coreRoughness:   0.6,
        coreClearcoat:   0.0,
        coreTransmission: 0.0,
        glowColor:       0xff8800,
        ringColors:      [0xffaa00, 0xff4400, 0xffdd00],
        ringCount:       3,
        inflowColor:     0xffaa00
    },
    // 5 — The Astral Leviathan: bioluminescent whale-bone, memory-fog particles
    5: {
        coreColor:       0x220044,
        coreEmissive:    0xff00ff,
        coreMetalness:   0.05,
        coreRoughness:   0.3,
        coreClearcoat:   0.6,
        coreTransmission: 0.2,
        glowColor:       0xcc00ff,
        ringColors:      [0xff44ff, 0x8800ff, 0x44ffff, 0xffffff],
        ringCount:       4,
        inflowColor:     0xdd44ff
    },
    // 6 — The Aqua Expanse: glowing coral + kelp, bubble-stream inflow
    6: {
        coreColor:       0x00ccaa,
        coreEmissive:    0x00ffcc,
        coreMetalness:   0.0,
        coreRoughness:   0.1,
        coreClearcoat:   0.9,
        coreTransmission: 0.45,
        glowColor:       0x00ffdd,
        ringColors:      [0x00ddff, 0x00ffaa, 0x44bbff],
        ringCount:       3,
        inflowColor:     0x44ffee
    }
};

/** Fallback biome config used when biome is 0 or unknown. */
const GA_BIOME_DEFAULT: GravityAnchorBiomeConfig = {
    coreColor:       0x8899ff,
    coreEmissive:    0x2244dd,
    coreMetalness:   0.2,
    coreRoughness:   0.0,
    coreClearcoat:   1.0,
    coreTransmission: 0.25,
    glowColor:       0x3355ff,
    ringColors:      [0x44aaff, 0x9944ff, 0xff44bb],
    ringCount:       3,
    inflowColor:     0x4466ff
};

/**
 * Creates a Gravity Anchor with biome-specific visual identity.
 *
 * @param config.size   Core radius in world units (8–15 recommended).
 * @param config.mass   Optional override for the gravitational force constant.
 * @param config.biome  Level index (1–6) that drives the visual theme.
 */
export function createGravityAnchor(config: { size: number; mass?: number; biome?: number }): THREE.Group {
    const group = new THREE.Group();
    const { size } = config;
    const bCfg: GravityAnchorBiomeConfig =
        GRAVITY_ANCHOR_BIOMES[config.biome ?? 0] ?? GA_BIOME_DEFAULT;

    // --- Core: glossy icosahedron styled per biome ---
    const coreGeo = new THREE.IcosahedronGeometry(size, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
        color:            bCfg.coreColor,
        emissive:         bCfg.coreEmissive,
        emissiveIntensity: 1.5,
        metalness:        bCfg.coreMetalness,
        roughness:        bCfg.coreRoughness,
        clearcoat:        bCfg.coreClearcoat,
        clearcoatRoughness: 0.05,
        transmission:     bCfg.coreTransmission,
        ior: 1.5,
        transparent: true,
        opacity: 0.92
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.castShadow = true;
    group.add(core);

    // --- Outer glow shell (back-side, additive) ---
    const glowGeo = new THREE.IcosahedronGeometry(size * 1.45, 1);
    const glowMat = new THREE.MeshBasicMaterial({
        color: bCfg.glowColor,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    group.add(new THREE.Mesh(glowGeo, glowMat));

    // --- Biome-specific orbiting rings (2–4 rings) ---
    const ringTilts: [number, number, number][] = [
        [0.4,  0.0,  0.0],
        [1.1,  0.5,  0.0],
        [0.2,  1.2,  0.4],
        [0.8, -0.3,  1.0]
    ];
    const ringCount = bCfg.ringCount;
    for (let i = 0; i < ringCount; i++) {
        const ringColor = bCfg.ringColors[i % bCfg.ringColors.length];
        const ringGeo = new THREE.TorusGeometry(size * (1.9 + i * 0.45), 0.14, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.set(...ringTilts[i % ringTilts.length]);
        ring.userData.ringIndex = i;
        ring.userData.ringSpeedY = 0.35 + i * 0.18;
        ring.userData.ringSpeedZ = 0.22 + i * 0.12;
        group.add(ring);
    }

    group.userData = {
        type: 'gravityAnchor',
        biome: config.biome ?? 0,
        fieldRadius: GA_FIELD_RADIUS,
        mass: config.mass ?? GA_MASS,
        size,
        coreObject: core,
        inflowColor: bCfg.inflowColor,
        /** Marks this object as a valid target for the player's TetherSystem. */
        tetherable: true,
        /** Tracks whether the player was inside the field on the previous frame. */
        wasInField: false,
        /** Accumulated angle (radians) the player has swept around the anchor while inside. */
        sweepAngle: 0.0,
        lastPlayerDir: null as THREE.Vector3 | null,
        /** Per-frame angular speed (radians/s) — updated in updateGravityAnchor. */
        angularSpeed: 0.0
    };

    return group;
}

/**
 * Animates a Gravity Anchor and computes the gravitational interaction for
 * the current frame.
 *
 * @returns GravityAnchorInteraction — caller should add `force` to player
 *          Y-velocity when `isInfluencing` is true.
 */
export function updateGravityAnchor(
    group: THREE.Group,
    delta: number,
    timeVal: number,
    playerPos: THREE.Vector3
): GravityAnchorInteraction {
    const result: GravityAnchorInteraction = {
        force: new THREE.Vector3(),
        isInfluencing: false,
        slungExit: false,
        distance: 0,
        angularSpeed: 0
    };

    const data = group.userData;

    // --- Visual: pulse emissive core ---
    const core = data.coreObject as THREE.Mesh;
    if (core) {
        const pulse = Math.sin(timeVal * 2.2) * 0.5 + 0.5;
        (core.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.7 + pulse * 1.6;
    }

    // --- Visual: rotate orbiting rings ---
    group.children.forEach(child => {
        if (child.userData.ringIndex !== undefined) {
            child.rotation.y += delta * child.userData.ringSpeedY;
            child.rotation.z += delta * child.userData.ringSpeedZ;
        }
    });

    // --- Visual: slow core tumble ---
    group.rotation.y += delta * 0.14;
    group.rotation.x += delta * 0.06;

    // --- Physics: inverse-square field ---
    const dist = group.position.distanceTo(playerPos);

    if (dist >= data.fieldRadius) {
        data.wasInField = false;
        data.sweepAngle = 0.0;
        data.lastPlayerDir = null;
        return result;
    }

    result.isInfluencing = true;
    result.distance = dist;

    // Softened inverse-square magnitude
    const soft2 = GA_SOFTENING * GA_SOFTENING;
    const rawMag = data.mass / (dist * dist + soft2);
    // Smooth edge fade so force drops to zero at the boundary
    const edgeFade = 1.0 - (dist / data.fieldRadius);
    const forceMag = Math.min(rawMag, GA_MAX_FORCE) * edgeFade;

    // Direction from player toward anchor
    const dir = new THREE.Vector3().subVectors(group.position, playerPos).normalize();
    result.force.copy(dir).multiplyScalar(forceMag * delta);

    // --- Sling detection: accumulate sweep angle while in field ---
    let frameAngle = 0;
    if (data.lastPlayerDir) {
        const cosAngle = THREE.MathUtils.clamp(
            (data.lastPlayerDir as THREE.Vector3).dot(dir), -1, 1
        );
        frameAngle = Math.acos(cosAngle);
        data.sweepAngle += frameAngle;
    }
    data.lastPlayerDir = dir.clone();

    // Angular speed in radians/s (smoothed to avoid spikes on first frame)
    data.angularSpeed = delta > 0 ? frameAngle / delta : 0;
    result.angularSpeed = data.angularSpeed as number;

    // --- Sling exit bonus: trigger on the first frame outside after a sweep ≥ 70° ---
    const wasIn = data.wasInField as boolean;
    data.wasInField = true;

    // Check for exit next frame is handled by the dist >= fieldRadius branch above,
    // but we can also look at the player being near the edge.
    if (wasIn && dist > data.fieldRadius * 0.85 && data.sweepAngle >= (70 * Math.PI / 180)) {
        result.slungExit = true;
        data.sweepAngle = 0.0;
    }

    return result;
}
