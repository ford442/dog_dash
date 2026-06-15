/**
 * Level-themed obstacle/enemy variants. Reskins the generic asteroid and
 * pattern-enemy meshes used by ObstacleSystem so each level's hazards feel
 * native to its biome instead of generic floating rocks.
 *
 * Used by obstacle_system.ts for both regular asteroids (`createAsteroid`)
 * and pattern formation enemies (`createPatternEnemy`). All materials are
 * plain MeshStandardMaterial/MeshPhysicalMaterial (no TSL) so they remain
 * compatible with ObstacleSystem's depth-based color fading, which mutates
 * `material.color` directly each frame.
 */

import * as THREE from 'three';

export interface LevelVariant {
    geometry: THREE.BufferGeometry;
    /** Build a material for this variant. `baseColorHex` is provided for
     *  pattern enemies (which use random per-instance hues); omit it for
     *  asteroids to get the variant's default palette. */
    createMaterial: (baseColorHex?: number) => THREE.Material;
    /** Optional decorative child meshes (petals, antennae, tentacles, ...). */
    createExtras?: (size: number) => THREE.Object3D[];
}

/** Icosahedron deformed with organic noise - the shared base shape. */
function noisyGeometry(ctor: () => THREE.BufferGeometry, noiseAmount: number): THREE.BufferGeometry {
    const geo = ctor();
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const noise = (Math.random() - 0.5) * noiseAmount;
        positions.setXYZ(
            i,
            positions.getX(i) * (1 + noise),
            positions.getY(i) * (1 + noise),
            positions.getZ(i) * (1 + noise)
        );
    }
    geo.computeVertexNormals();
    return geo;
}

// --- L1 Neon Garden: glowing pollen pod ---
function pollenPodVariant(size: number): LevelVariant {
    return {
        geometry: noisyGeometry(() => new THREE.IcosahedronGeometry(size, 1), 0.25),
        createMaterial: (baseColorHex) => new THREE.MeshStandardMaterial({
            color: baseColorHex ?? 0x336633,
            roughness: 0.5,
            metalness: 0.1,
            emissive: 0x66ff99,
            emissiveIntensity: 0.5,
            flatShading: true
        }),
        createExtras: (size) => {
            const petals: THREE.Object3D[] = [];
            const petalMat = new THREE.MeshStandardMaterial({
                color: 0xff66cc,
                emissive: 0xff66cc,
                emissiveIntensity: 0.8,
                roughness: 0.4
            });
            const count = 3 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                const petal = new THREE.Mesh(new THREE.ConeGeometry(size * 0.25, size * 0.7, 5), petalMat);
                const angle = (i / count) * Math.PI * 2;
                petal.position.set(Math.cos(angle) * size * 0.8, Math.sin(angle) * size * 0.8, 0);
                petal.rotation.z = angle + Math.PI / 2;
                petals.push(petal);
            }
            return petals;
        }
    };
}

// --- L2 Asteroid Belt: jagged chroma crystal shard ---
function chromaShardVariant(size: number): LevelVariant {
    const glowHex = Math.random() < 0.5 ? 0x00ffff : 0xff00ff;
    return {
        geometry: noisyGeometry(() => new THREE.OctahedronGeometry(size, 0), 0.35),
        createMaterial: (baseColorHex) => new THREE.MeshPhysicalMaterial({
            color: baseColorHex ?? 0x4422aa,
            emissive: glowHex,
            emissiveIntensity: 0.6,
            metalness: 0.7,
            roughness: 0.15,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            flatShading: true
        }),
        createExtras: (size) => {
            const shards: THREE.Object3D[] = [];
            const shardMat = new THREE.MeshPhysicalMaterial({
                color: 0x4422aa,
                emissive: glowHex,
                emissiveIntensity: 0.6,
                metalness: 0.7,
                roughness: 0.15,
                clearcoat: 1.0,
                flatShading: true
            });
            const count = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const shard = new THREE.Mesh(new THREE.OctahedronGeometry(size * (0.25 + Math.random() * 0.2), 0), shardMat);
                shard.position.set(
                    (Math.random() - 0.5) * size * 1.4,
                    (Math.random() - 0.5) * size * 1.4,
                    (Math.random() - 0.5) * size * 1.4
                );
                shards.push(shard);
            }
            return shards;
        }
    };
}

// --- L3 Orbital Descent: scorched re-entry scrap ---
function reentryScrapVariant(size: number): LevelVariant {
    const geo = noisyGeometry(() => new THREE.IcosahedronGeometry(size, 1), 0.3);
    // Flatten into a debris-like slab
    geo.scale(1.3, 0.6, 1.1);
    return {
        geometry: geo,
        createMaterial: (baseColorHex) => new THREE.MeshStandardMaterial({
            color: baseColorHex ?? 0x332222,
            roughness: 0.55,
            metalness: 0.7,
            emissive: 0xff5500,
            emissiveIntensity: 0.4,
            flatShading: true
        }),
        createExtras: (size) => {
            const panelMat = new THREE.MeshStandardMaterial({
                color: 0x222222,
                roughness: 0.6,
                metalness: 0.8,
                emissive: 0xff5500,
                emissiveIntensity: 0.3
            });
            const panel = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, size * 0.08, size * 0.5), panelMat);
            panel.position.set(size * 0.2, size * 0.4, 0);
            panel.rotation.z = (Math.random() - 0.5) * 0.6;
            return [panel];
        }
    };
}

// --- L4 Rusty Gauntlet: rusty drone husk with warning light ---
function rustyDroneHuskVariant(size: number): LevelVariant {
    return {
        geometry: noisyGeometry(() => new THREE.DodecahedronGeometry(size, 0), 0.15),
        createMaterial: (baseColorHex) => new THREE.MeshStandardMaterial({
            color: baseColorHex ?? 0x8b4513,
            roughness: 0.7,
            metalness: 0.85,
            emissive: 0xff2200,
            emissiveIntensity: 0.2,
            flatShading: true
        }),
        createExtras: (size) => {
            const lightMat = new THREE.MeshStandardMaterial({
                color: 0xff2200,
                emissive: 0xff2200,
                emissiveIntensity: 1.2,
                roughness: 0.3
            });
            const light = new THREE.Mesh(new THREE.SphereGeometry(size * 0.18, 8, 8), lightMat);
            light.position.set(size * 0.7, size * 0.5, size * 0.3);
            return [light];
        }
    };
}

// --- L5 Astral Leviathan: bioluminescent krill pod ---
function krillPodVariant(size: number): LevelVariant {
    return {
        geometry: noisyGeometry(() => new THREE.SphereGeometry(size, 10, 10), 0.15),
        createMaterial: (baseColorHex) => new THREE.MeshPhysicalMaterial({
            color: baseColorHex ?? 0xff66cc,
            emissive: 0xff1493,
            emissiveIntensity: 0.5,
            transmission: 0.5,
            thickness: 1.0,
            roughness: 0.25,
            transparent: true,
            opacity: 0.85
        }),
        createExtras: (size) => {
            const podMat = new THREE.MeshPhysicalMaterial({
                color: 0xff99dd,
                emissive: 0xff1493,
                emissiveIntensity: 0.5,
                transmission: 0.5,
                roughness: 0.25,
                transparent: true,
                opacity: 0.85
            });
            const pods: THREE.Object3D[] = [];
            const count = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                const pod = new THREE.Mesh(new THREE.SphereGeometry(size * (0.3 + Math.random() * 0.2), 8, 8), podMat);
                pod.position.set(
                    (Math.random() - 0.5) * size * 1.8,
                    (Math.random() - 0.5) * size * 1.8,
                    (Math.random() - 0.5) * size * 1.8
                );
                pods.push(pod);
            }
            return pods;
        }
    };
}

// --- L6 Aqua Expanse: drifting jellyfish ---
function jellyDrifterVariant(size: number): LevelVariant {
    const geo = noisyGeometry(() => new THREE.SphereGeometry(size, 10, 10), 0.1);
    geo.scale(1.0, 0.55, 1.0);
    return {
        geometry: geo,
        createMaterial: (baseColorHex) => new THREE.MeshPhysicalMaterial({
            color: baseColorHex ?? 0x66ccff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.4,
            transmission: 0.6,
            roughness: 0.2,
            transparent: true,
            opacity: 0.7
        }),
        createExtras: (size) => {
            const tentacleMat = new THREE.MeshPhysicalMaterial({
                color: 0x66ccff,
                emissive: 0x00ffff,
                emissiveIntensity: 0.4,
                transmission: 0.5,
                roughness: 0.2,
                transparent: true,
                opacity: 0.5
            });
            const tentacles: THREE.Object3D[] = [];
            const count = 4 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const tentacle = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.05, size * 0.02, size * 1.4, 5), tentacleMat);
                const angle = (i / count) * Math.PI * 2;
                tentacle.position.set(Math.cos(angle) * size * 0.5, -size * 0.9, Math.sin(angle) * size * 0.5);
                tentacle.rotation.z = (Math.random() - 0.5) * 0.3;
                tentacles.push(tentacle);
            }
            return tentacles;
        }
    };
}

const VARIANTS: Record<number, (size: number) => LevelVariant> = {
    1: pollenPodVariant,
    2: chromaShardVariant,
    3: reentryScrapVariant,
    4: rustyDroneHuskVariant,
    5: krillPodVariant,
    6: jellyDrifterVariant
};

/**
 * Reskin a mesh to match the given level's theme: replaces its geometry,
 * builds a themed material (optionally tinted with `baseColorHex` for
 * pattern enemies), and attaches decorative extras as children.
 */
export function applyLevelVariant(mesh: THREE.Mesh, level: number, size: number, baseColorHex?: number): void {
    const build = VARIANTS[level];
    if (!build) return;

    const variant = build(size);

    mesh.geometry.dispose();
    mesh.geometry = variant.geometry;

    if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
    } else {
        mesh.material.dispose();
    }
    mesh.material = variant.createMaterial(baseColorHex);

    if (variant.createExtras) {
        for (const extra of variant.createExtras(size)) {
            mesh.add(extra);
        }
    }
}
