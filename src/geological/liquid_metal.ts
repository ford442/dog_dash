import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { time, positionLocal, normalLocal, color, sin, mix, float } from 'three/tsl';
import { fbm } from './geodes';
import { disposeGeometryIfOwned } from '../gpu_resources';

// 7. LIQUID METAL BLOBS (Advanced Splitting/Recombining)

/**
 * Creates a TSL material for liquid chrome.
 * Features:
 * - High metalness/reflectivity (relies on scene.environment)
 * - Vertex wobble via noise to simulate liquid surface tension
 */
function createLiquidChromeMaterial() {
    const mat = new MeshStandardNodeMaterial({
        color: 0xaaaaaa,
        metalness: 1.0,
        roughness: 0.0,
        envMapIntensity: 1.0
    });

    const uTime = time;
    const pos = positionLocal;
    const norm = normalLocal;

    // Liquid Wobble
    // Use fbm (3D noise) to displace vertices along normal
    const noiseScale = float(0.8);
    const noiseSpeed = uTime.mul(0.5);
    
    const n = fbm(pos.mul(noiseScale).add(noiseSpeed)); // -1..1 approx

    // Displacement amplitude
    const amp = float(0.3);
    const displacement = norm.mul(n.mul(amp));

    mat.positionNode = pos.add(displacement);

    return mat;
}

export class LiquidMetalBlob {
    mesh: THREE.Mesh; // Main central blob
    group: THREE.Group; // Container
    droplets: { mesh: THREE.Mesh; velocity: THREE.Vector3; offset: THREE.Vector3 }[] = [];

    active: boolean = true;
    isSplit: boolean = false;
    splitTimer: number = 0;

    baseSize: number;
    dropletMaterial: MeshStandardNodeMaterial;

    constructor(config: { size: number }) {
        this.baseSize = config.size;
        this.group = new THREE.Group();

        this.dropletMaterial = createLiquidChromeMaterial();

        const geo = new THREE.SphereGeometry(config.size, 64, 64);
        this.mesh = new THREE.Mesh(geo, this.dropletMaterial);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.group.add(this.mesh);

        this.group.userData = {
            type: 'liquidMetalBlob',
            parent: this,
            radius: config.size
        };
    }

    split(impactVelocity: THREE.Vector3) {
        if (this.isSplit) return;
        this.isSplit = true;
        this.mesh.visible = false;
        this.splitTimer = 5.0; // Seconds before re-merge complete

        // Spawn droplets
        const count = 5 + Math.floor(Math.random() * 4);
        const volumePerDroplet = (this.baseSize * this.baseSize * this.baseSize) / count;
        const dropletRadius = Math.cbrt(volumePerDroplet);

        for(let i=0; i<count; i++) {
            const geo = new THREE.SphereGeometry(dropletRadius, 32, 32);
            const mesh = new THREE.Mesh(geo, this.dropletMaterial);

            // Initial position (center)
            mesh.position.set(0, 0, 0);

            // Random explosion velocity + impact influence
            const explosion = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(5.0 + Math.random() * 5.0);

            // Add some of the impact
            const impactDir = impactVelocity.clone().normalize().multiplyScalar(2.0);
            const finalVel = explosion.add(impactDir);

            this.droplets.push({
                mesh: mesh,
                velocity: finalVel,
                offset: new THREE.Vector3(0,0,0) // Tracks local position relative to group
            });

            this.group.add(mesh);
        }
    }

    recombine() {
        this.isSplit = false;
        this.mesh.visible = true;
        // Clean up droplets
        this.droplets.forEach(d => {
            this.group.remove(d.mesh);
            // Geometry is per-droplet; material is shared with the parent blob
            disposeGeometryIfOwned(d.mesh.geometry);
        });
        this.droplets = [];
    }

    update(delta: number) {
        if (!this.active) return;
        
        // Wobble rotation
        this.group.rotation.x += delta * 0.2;
        this.group.rotation.y += delta * 0.1;

        if (this.isSplit) {
            this.splitTimer -= delta;

            // Update droplets
            // Physics: Move, Damp, Attract
            const attractionSpeed = 10.0 * delta; // Increases as timer drops?
            const damping = 0.95;

            // Center of mass attraction
            const center = new THREE.Vector3(0, 0, 0);

            this.droplets.forEach(d => {
                // Move
                d.offset.addScaledVector(d.velocity, delta);

                // Drag
                d.velocity.multiplyScalar(damping);

                // Attraction (Spring force back to center)
                // Stronger attraction when timer is low
                const factor = Math.max(0, 5.0 - this.splitTimer) * 2.0;
                const dir = center.clone().sub(d.offset).normalize();
                const dist = d.offset.length();

                if (dist > 0.1) {
                    d.velocity.add(dir.multiplyScalar(factor * delta));
                }

                // Apply to mesh
                d.mesh.position.copy(d.offset);
            });

            // Recombine check
            if (this.splitTimer <= 0) {
                this.recombine();
            }
        }
    }
}

export class LiquidMetalSystem {
    blobs: LiquidMetalBlob[] = [];
    scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    createBlob(position: THREE.Vector3, size: number = 3.0) {
        const blob = new LiquidMetalBlob({ size });
        blob.group.position.copy(position);
        this.scene.add(blob.group);
        this.blobs.push(blob);
        return blob;
    }

    checkCollisions(projectiles: any[]) {
        // Simple bounding sphere check
        for (const blob of this.blobs) {
            if (!blob.active || blob.isSplit) continue;

            const blobRadius = blob.baseSize; // Approx
            const blobPos = blob.group.position;

            for (const proj of projectiles) {
                if (!proj.active) continue;

                const dist = proj.mesh.position.distanceTo(blobPos);
                if (dist < blobRadius + 0.5) {
                    // Hit!
                    // console.log("Liquid Metal Hit!");
                    blob.split(proj.velocity || new THREE.Vector3(10, 0, 0));

                    // Consume projectile? Or allow pierce?
                    // Let's consume.
                    proj.deactivate();

                    // Particles
                    // particleSystem.emit(blobPos, 0xaaaaaa, 10, 5.0, 1.0);
                    // (Passed externally? Or we assume global access? Better not assume.)
                    // Return hit info?
                }
            }
        }
    }

    update(delta: number) {
        for (let i = this.blobs.length - 1; i >= 0; i--) {
            const blob = this.blobs[i];
            blob.update(delta);

            // Cleanup far away blobs?
            // Assuming LevelManager handles main cleanup via clear(),
            // but we might want to cull distance here if list grows.
            // For now, keep simple.
        }
    }
}

// Keep the old function for compatibility, but redirect to a new instance logic?
// Main.ts calls this function and adds the result to a list.
// If we change main.ts to use the System, we don't need this to return a Group in the old way,
// OR we return the group managed by the blob.
// But `main.ts` expects to manage the update loop for these items currently.
// Plan: Update `main.ts` to use `LiquidMetalSystem` exclusively.
// So this function can be deprecated or used as a factory if needed.
// We will modify `main.ts` to use `liquidMetalSystem.createBlob` instead of calling this.
// So I will leave this as a stub or remove it?
// The plan says: "Modify createLiquidMetalBlobAtPosition to use liquidMetalSystem.createBlob".
// So this export is not needed anymore for `main.ts` logic if I update `main.ts`.
// I will keep a dummy version or just remove it.
// Actually, to avoid breaking other imports (if any), I'll keep it as a wrapper for creating a standalone blob group,
// but without the system management, it won't update/split.
// Better: Remove it and fix `main.ts`.

export function createLiquidMetalBlob(config: { size: number }) {
   // Deprecated: Use LiquidMetalSystem
   console.warn("createLiquidMetalBlob is deprecated. Use LiquidMetalSystem.");
   return new THREE.Group();
}

export function updateLiquidMetalBlob(_group: THREE.Group, _delta: number, _timeVal: number) {
    // Deprecated
}

