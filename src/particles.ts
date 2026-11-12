import * as THREE from 'three';
import { getGpuChores } from './gpu_chores';
import {
    getGpuIntegrate,
    IntegrateBinding,
    type IntegrableSystem,
    type IntegrateKernel
} from './gpu_integrate';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Instances whose world-space scale falls below this are sub-pixel at any
 * sane camera distance, so they are dropped from the draw list by the chores
 * compact pass. Purely cosmetic — the simulation still ages them normally.
 */
const DRAW_SCALE_EPSILON = 0.01;

/** Shared tumble phase for particle instances (cosmetic only). */
let _particleSpin = 0;
const TWO_PI = Math.PI * 2;

/**
 * Keeps the tumble phase small. It grows by 2·delta per live particle per
 * step, so unwrapped it reaches millions of radians in a long session — past
 * where f32 (the instance attribute, and the GPU integrate's sin/cos) can
 * resolve a rotation. The matrix is 2π-periodic, so wrapping is invisible.
 */
function wrapParticleSpin(): void {
    if (_particleSpin >= TWO_PI) _particleSpin %= TWO_PI;
}

/** Test seam: golden fixtures start from a known tumble phase. */
export function resetParticleSpinForTests(): void {
    _particleSpin = 0;
}

export class ParticleSystem implements IntegrableSystem {
    readonly integrateKind = 'particles' as const;
    maxParticles: number;
    count: number;

    // SoA (Structure of Arrays) layout for better performance
    positionX: Float32Array;
    positionY: Float32Array;
    positionZ: Float32Array;

    velocityX: Float32Array;
    velocityY: Float32Array;
    velocityZ: Float32Array;

    life: Float32Array;      // Current remaining life
    maxLife: Float32Array;   // Total lifetime

    size: Float32Array;

    colorR: Float32Array;
    colorG: Float32Array;
    colorB: Float32Array;

    mesh: THREE.InstancedMesh;

    /** Per-particle draw scale, input to the chores compact pass. */
    drawScale: Float32Array;
    /** Tumble phase captured during simulation, replayed when building matrices. */
    drawRotation: Float32Array;
    /** Compacted draw list produced by the chores layer. */
    drawIndices: Uint32Array;
    /** Instances actually submitted last frame (`<= count`). */
    drawCount: number = 0;

    /** GPU-mode integrate, when a kernel has been handed over (see gpu_integrate/). */
    private integrate: IntegrateBinding | null = null;

    constructor(scene: THREE.Scene, maxParticles: number = 2000) {
        this.maxParticles = maxParticles;
        this.count = 0;
        
        // Initialize Typed Arrays
        this.positionX = new Float32Array(maxParticles);
        this.positionY = new Float32Array(maxParticles);
        this.positionZ = new Float32Array(maxParticles);

        this.velocityX = new Float32Array(maxParticles);
        this.velocityY = new Float32Array(maxParticles);
        this.velocityZ = new Float32Array(maxParticles);

        this.life = new Float32Array(maxParticles);
        this.maxLife = new Float32Array(maxParticles);

        this.size = new Float32Array(maxParticles);

        this.colorR = new Float32Array(maxParticles);
        this.colorG = new Float32Array(maxParticles);
        this.colorB = new Float32Array(maxParticles);

        this.drawScale = new Float32Array(maxParticles);
        this.drawRotation = new Float32Array(maxParticles);
        this.drawIndices = new Uint32Array(maxParticles);

        // Geometry: More varied shapes for visual interest
        const geometries = [
            new THREE.DodecahedronGeometry(0.15, 0),
            new THREE.OctahedronGeometry(0.15, 0),
            new THREE.TetrahedronGeometry(0.15, 0)
        ];
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        
        // Material: Enhanced emissive for that "glowing plasma" look
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.6,
            emissive: 0xffffff,
            emissiveIntensity: 3.0,
            transparent: true,
            opacity: 0.9
        });

        this.mesh = new THREE.InstancedMesh(geometry, material, maxParticles);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        
        // Add color attribute for individual particle colors
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxParticles * 3), 3);
        
        scene.add(this.mesh);
    }

    emit(pos: THREE.Vector3, colorHex: number, count: number = 1, speed: number = 1.0, size: number = 1.0, spread: number = 0.5) {
        _color.setHex(colorHex);

        for (let i = 0; i < count; i++) {
            let index = this.count;
            if (this.count >= this.maxParticles) {
                return;
            } else {
                this.count++;
            }

            // Position with jitter
            this.positionX[index] = pos.x + (Math.random() - 0.5) * spread;
            this.positionY[index] = pos.y + (Math.random() - 0.5) * spread;
            this.positionZ[index] = pos.z + (Math.random() - 0.5) * spread;

            // Velocity (Random direction)
            const vx = (Math.random() - 0.5);
            const vy = (Math.random() - 0.5);
            const vz = (Math.random() - 0.5);
            const len = Math.sqrt(vx*vx + vy*vy + vz*vz) || 1;
            const s = speed * (0.5 + Math.random() * 0.5);

            this.velocityX[index] = (vx / len) * s;
            this.velocityY[index] = (vy / len) * s;
            this.velocityZ[index] = (vz / len) * s;

            // Color
            this.colorR[index] = _color.r;
            this.colorG[index] = _color.g;
            this.colorB[index] = _color.b;

            // Life & Size
            const life = 0.5 + Math.random() * 0.5;
            this.life[index] = life;
            this.maxLife[index] = life;
            this.size[index] = size * (0.8 + Math.random() * 0.4);
        }
    }

    get integrateBackend(): string {
        return this.integrate ? this.integrate.kernel.id : 'js';
    }

    /**
     * Moves the integrate onto `kernel`, or back to JS with `null`.
     * JS → kernel uploads every live particle (the CPU SoA is current).
     * kernel → JS drops in-flight particles: their kinematics lived on the GPU
     * and a lost device cannot be read back. At most ~1 s of sparks vanish.
     */
    setIntegrateKernel(kernel: IntegrateKernel | null): void {
        if (this.integrate) {
            this.integrate.dispose();
            this.integrate = null;
            this.count = 0;
            this.drawCount = 0;
            this.mesh.count = 0;
        }
        if (kernel) {
            this.integrate = new IntegrateBinding(kernel, true);
            // Until the first readback lands, keep showing what JS last drew —
            // and never the mesh's initial `count = max` identity instances.
            this.mesh.count = this.drawCount;
        }
    }

    /** Applies a GPU readback that landed after the last step (test seam / idle frames). */
    syncIntegrateDraw(): void {
        this.integrate?.applyLatest(this.mesh);
    }

    update(delta: number) {
        const gpu = this.integrate;
        if (gpu) {
            if (!gpu.failed) {
                this.updateOnKernel(delta, gpu);
                return;
            }
            this.setIntegrateKernel(null);
            getGpuIntegrate().publish();
        }
        this.updateJs(delta);
    }

    /**
     * GPU-mode step: the CPU runs the same lifecycle as {@link updateJs}
     * (life, swap-remove order, spin, scale, compaction); the kernel advances
     * position/velocity and builds the matrices. Draws the last finished
     * readback — never blocks on the GPU.
     */
    private updateOnKernel(delta: number, gpu: IntegrateBinding): void {
        gpu.applyLatest(this.mesh);
        gpu.uploadEmitted(this.count, (i, out, o) => {
            out[o] = this.positionX[i]!;
            out[o + 1] = this.positionY[i]!;
            out[o + 2] = this.positionZ[i]!;
            out[o + 3] = 0;
            out[o + 4] = this.velocityX[i]!;
            out[o + 5] = this.velocityY[i]!;
            out[o + 6] = this.velocityZ[i]!;
            out[o + 7] = 0;
        });
        gpu.resetPerm(this.count);

        for (let i = 0; i < this.count; i++) {
            this.life[i] -= delta;

            if (this.life[i] <= 0) {
                const last = this.count - 1;
                if (i < last) {
                    this.life[i] = this.life[last];
                    this.maxLife[i] = this.maxLife[last];
                    this.size[i] = this.size[last];
                    this.colorR[i] = this.colorR[last];
                    this.colorG[i] = this.colorG[last];
                    this.colorB[i] = this.colorB[last];
                    gpu.swap(i, last);
                }
                this.count--;
                i--;
                continue;
            }

            _particleSpin += delta * 2;
            this.drawRotation[i] = _particleSpin;
            this.drawScale[i] = this.size[i] * (this.life[i] / this.maxLife[i]);
        }
        wrapParticleSpin();

        const kept = getGpuChores().compact(this.drawScale, this.count, this.drawIndices, DRAW_SCALE_EPSILON);
        this.drawCount = kept;

        const colors = gpu.slotColors!;
        for (let slot = 0; slot < kept; slot++) {
            const i = this.drawIndices[slot]!;
            gpu.setSlot(slot, i, this.drawScale[i]!, this.drawRotation[i]!);
            colors[slot * 3] = this.colorR[i]!;
            colors[slot * 3 + 1] = this.colorG[i]!;
            colors[slot * 3 + 2] = this.colorB[i]!;
        }

        gpu.submit(this.count, delta, kept);
        gpu.applyLatest(this.mesh);
    }

    /** The JS integrate: CPU reference and the default path. */
    private updateJs(delta: number) {
        const matrix = _dummy.matrix;

        // Iterate forward. If dead, swap with last and decrement count.
        for (let i = 0; i < this.count; i++) {
            this.life[i] -= delta;

            if (this.life[i] <= 0) {
                // Particle Died. Swap with the last active particle.
                const last = this.count - 1;

                if (i < last) {
                    this.positionX[i] = this.positionX[last];
                    this.positionY[i] = this.positionY[last];
                    this.positionZ[i] = this.positionZ[last];

                    this.velocityX[i] = this.velocityX[last];
                    this.velocityY[i] = this.velocityY[last];
                    this.velocityZ[i] = this.velocityZ[last];

                    this.life[i] = this.life[last];
                    this.maxLife[i] = this.maxLife[last];

                    this.size[i] = this.size[last];

                    this.colorR[i] = this.colorR[last];
                    this.colorG[i] = this.colorG[last];
                    this.colorB[i] = this.colorB[last];
                }

                this.count--;
                i--; // Re-process this index
                continue;
            }

            // Update Physics
            this.positionX[i] += this.velocityX[i] * delta;
            this.positionY[i] += this.velocityY[i] * delta;
            this.positionZ[i] += this.velocityZ[i] * delta;

            // Gravity
            this.velocityY[i] -= 2.0 * delta;

            _particleSpin += delta * 2;
            this.drawRotation[i] = _particleSpin;
            this.drawScale[i] = this.size[i] * (this.life[i] / this.maxLife[i]);
        }
        wrapParticleSpin();

        // ── Chore: compact the draw list ────────────────────────────────────
        // Non-authoritative. The SoA above is already final for this frame;
        // all this does is decide which instances are worth submitting.
        const kept = getGpuChores().compact(
            this.drawScale,
            this.count,
            this.drawIndices,
            DRAW_SCALE_EPSILON
        );
        this.drawCount = kept;

        for (let slot = 0; slot < kept; slot++) {
            const i = this.drawIndices[slot];

            _dummy.position.set(this.positionX[i], this.positionY[i], this.positionZ[i]);
            _dummy.scale.setScalar(this.drawScale[i]);
            // Y stays 0. (It used to inherit whatever the shared _dummy last
            // held from DebrisSystem — an accidental cross-system coupling.)
            _dummy.rotation.set(this.drawRotation[i], 0, this.drawRotation[i]);

            _dummy.updateMatrix();
            this.mesh.setMatrixAt(slot, matrix);

            _color.setRGB(this.colorR[i], this.colorG[i], this.colorB[i]);
            this.mesh.setColorAt(slot, _color);
        }

        this.mesh.count = kept;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    /**
     * Cosmetic draw statistics for the debug panel. Uses the chores `reduce`
     * tier; called on demand, never per frame from the render path.
     */
    getDrawStats(): { alive: number; drawn: number; culled: number; peakScale: number } {
        const peakScale = getGpuChores().reduce(this.drawScale, this.count, 'max');
        return {
            alive: this.count,
            drawn: this.drawCount,
            culled: this.count - this.drawCount,
            peakScale
        };
    }
}

/**
 * DebrisSystem: Manages rocky debris from destroyed asteroids.
 * Features tumbling physics, no gravity (drift), and rocky visual style.
 */
export class DebrisSystem implements IntegrableSystem {
    readonly integrateKind = 'debris' as const;
    maxParticles: number;
    count: number;

    positionX: Float32Array;
    positionY: Float32Array;
    positionZ: Float32Array;

    velocityX: Float32Array;
    velocityY: Float32Array;
    velocityZ: Float32Array;

    rotationX: Float32Array;
    rotationY: Float32Array;
    rotationZ: Float32Array;

    rotSpeedX: Float32Array;
    rotSpeedY: Float32Array;

    life: Float32Array;
    maxLife: Float32Array;
    size: Float32Array;

    mesh: THREE.InstancedMesh;

    /** Per-instance draw scale, input to the chores compact pass. */
    drawScale: Float32Array;
    /** Compacted draw list produced by the chores layer. */
    drawIndices: Uint32Array;
    /** Instances actually submitted last frame (`<= count`). */
    drawCount: number = 0;

    /** GPU-mode integrate, when a kernel has been handed over (see gpu_integrate/). */
    private integrate: IntegrateBinding | null = null;

    constructor(scene: THREE.Scene, maxParticles: number = 500) {
        this.maxParticles = maxParticles;
        this.count = 0;

        this.positionX = new Float32Array(maxParticles);
        this.positionY = new Float32Array(maxParticles);
        this.positionZ = new Float32Array(maxParticles);

        this.velocityX = new Float32Array(maxParticles);
        this.velocityY = new Float32Array(maxParticles);
        this.velocityZ = new Float32Array(maxParticles);

        this.rotationX = new Float32Array(maxParticles);
        this.rotationY = new Float32Array(maxParticles);
        this.rotationZ = new Float32Array(maxParticles);

        this.rotSpeedX = new Float32Array(maxParticles);
        this.rotSpeedY = new Float32Array(maxParticles);

        this.life = new Float32Array(maxParticles);
        this.maxLife = new Float32Array(maxParticles);
        this.size = new Float32Array(maxParticles);

        this.drawScale = new Float32Array(maxParticles);
        this.drawIndices = new Uint32Array(maxParticles);

        // Rocky geometry
        const geometry = new THREE.IcosahedronGeometry(0.2, 0);

        // Rocky material
        const material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.9,
            metalness: 0.2,
            flatShading: true
        });

        this.mesh = new THREE.InstancedMesh(geometry, material, maxParticles);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.mesh);
    }

    emit(pos: THREE.Vector3, count: number = 3, speed: number = 5.0, size: number = 1.0) {
        for (let i = 0; i < count; i++) {
            if (this.count >= this.maxParticles) return;
            const index = this.count++;

            const spread = 1.0;
            this.positionX[index] = pos.x + (Math.random() - 0.5) * spread;
            this.positionY[index] = pos.y + (Math.random() - 0.5) * spread;
            this.positionZ[index] = pos.z + (Math.random() - 0.5) * spread;

            // Random divergent velocity
            const vx = (Math.random() - 0.5);
            const vy = (Math.random() - 0.5);
            const vz = (Math.random() - 0.5);
            const len = Math.sqrt(vx*vx + vy*vy + vz*vz) || 1;

            // Speed variance
            const s = speed * (0.8 + Math.random() * 0.4);

            this.velocityX[index] = (vx / len) * s;
            this.velocityY[index] = (vy / len) * s;
            this.velocityZ[index] = (vz / len) * s;

            // Random rotation
            this.rotationX[index] = Math.random() * Math.PI;
            this.rotationY[index] = Math.random() * Math.PI;
            this.rotationZ[index] = Math.random() * Math.PI;

            this.rotSpeedX[index] = (Math.random() - 0.5) * 5.0;
            this.rotSpeedY[index] = (Math.random() - 0.5) * 5.0;

            const life = 2.0 + Math.random() * 2.0;
            this.life[index] = life;
            this.maxLife[index] = life;
            this.size[index] = size * (0.5 + Math.random() * 0.5);
        }
    }

    get integrateBackend(): string {
        return this.integrate ? this.integrate.kernel.id : 'js';
    }

    /** See {@link ParticleSystem.setIntegrateKernel}. Debris lives ≤ 4 s. */
    setIntegrateKernel(kernel: IntegrateKernel | null): void {
        if (this.integrate) {
            this.integrate.dispose();
            this.integrate = null;
            this.count = 0;
            this.drawCount = 0;
            this.mesh.count = 0;
        }
        if (kernel) {
            this.integrate = new IntegrateBinding(kernel, false);
            // Until the first readback lands, keep showing what JS last drew —
            // and never the mesh's initial `count = max` identity instances.
            this.mesh.count = this.drawCount;
        }
    }

    /** See {@link ParticleSystem.syncIntegrateDraw}. */
    syncIntegrateDraw(): void {
        this.integrate?.applyLatest(this.mesh);
    }

    update(delta: number) {
        const gpu = this.integrate;
        if (gpu) {
            if (!gpu.failed) {
                this.updateOnKernel(delta, gpu);
                return;
            }
            this.setIntegrateKernel(null);
            getGpuIntegrate().publish();
        }
        this.updateJs(delta);
    }

    /** GPU-mode step; CPU keeps life/order/scale, the kernel keeps kinematics. */
    private updateOnKernel(delta: number, gpu: IntegrateBinding): void {
        gpu.applyLatest(this.mesh);
        gpu.uploadEmitted(this.count, (i, out, o) => {
            out[o] = this.positionX[i]!;
            out[o + 1] = this.positionY[i]!;
            out[o + 2] = this.positionZ[i]!;
            out[o + 3] = 0;
            out[o + 4] = this.velocityX[i]!;
            out[o + 5] = this.velocityY[i]!;
            out[o + 6] = this.velocityZ[i]!;
            out[o + 7] = 0;
            out[o + 8] = this.rotationX[i]!;
            out[o + 9] = this.rotationY[i]!;
            out[o + 10] = this.rotationZ[i]!;
            out[o + 11] = 0;
            out[o + 12] = this.rotSpeedX[i]!;
            out[o + 13] = this.rotSpeedY[i]!;
            out[o + 14] = 0;
            out[o + 15] = 0;
        });
        gpu.resetPerm(this.count);

        for (let i = 0; i < this.count; i++) {
            this.life[i] -= delta;

            if (this.life[i] <= 0) {
                const last = this.count - 1;
                if (i < last) {
                    this.life[i] = this.life[last];
                    this.maxLife[i] = this.maxLife[last];
                    this.size[i] = this.size[last];
                    gpu.swap(i, last);
                }
                this.count--;
                i--;
                continue;
            }

            let s = this.size[i];
            if (this.life[i] < 0.5) {
                s *= (this.life[i] / 0.5);
            }
            this.drawScale[i] = s;
        }

        const kept = getGpuChores().compact(this.drawScale, this.count, this.drawIndices, DRAW_SCALE_EPSILON);
        this.drawCount = kept;
        for (let slot = 0; slot < kept; slot++) {
            const i = this.drawIndices[slot]!;
            gpu.setSlot(slot, i, this.drawScale[i]!);
        }

        gpu.submit(this.count, delta, kept);
        gpu.applyLatest(this.mesh);
    }

    /** The JS integrate: CPU reference and the default path. */
    private updateJs(delta: number) {
        const matrix = _dummy.matrix;

        for (let i = 0; i < this.count; i++) {
            this.life[i] -= delta;

            if (this.life[i] <= 0) {
                // Swap-remove
                const last = this.count - 1;
                if (i < last) {
                    this.positionX[i] = this.positionX[last];
                    this.positionY[i] = this.positionY[last];
                    this.positionZ[i] = this.positionZ[last];

                    this.velocityX[i] = this.velocityX[last];
                    this.velocityY[i] = this.velocityY[last];
                    this.velocityZ[i] = this.velocityZ[last];

                    this.rotationX[i] = this.rotationX[last];
                    this.rotationY[i] = this.rotationY[last];
                    this.rotationZ[i] = this.rotationZ[last];
                    this.rotSpeedX[i] = this.rotSpeedX[last];
                    this.rotSpeedY[i] = this.rotSpeedY[last];

                    this.life[i] = this.life[last];
                    this.maxLife[i] = this.maxLife[last];
                    this.size[i] = this.size[last];
                }
                this.count--;
                i--;
                continue;
            }

            // Physics (Drift)
            this.positionX[i] += this.velocityX[i] * delta;
            this.positionY[i] += this.velocityY[i] * delta;
            this.positionZ[i] += this.velocityZ[i] * delta;

            // Tumbling
            this.rotationX[i] += this.rotSpeedX[i] * delta;
            this.rotationY[i] += this.rotSpeedY[i] * delta;

            // Shrink only at very end
            let s = this.size[i];
            if (this.life[i] < 0.5) {
                s *= (this.life[i] / 0.5);
            }
            this.drawScale[i] = s;
        }

        // ── Chore: compact the draw list (cosmetic; simulation untouched) ───
        const kept = getGpuChores().compact(
            this.drawScale,
            this.count,
            this.drawIndices,
            DRAW_SCALE_EPSILON
        );
        this.drawCount = kept;

        for (let slot = 0; slot < kept; slot++) {
            const i = this.drawIndices[slot];

            _dummy.position.set(this.positionX[i], this.positionY[i], this.positionZ[i]);
            _dummy.rotation.set(this.rotationX[i], this.rotationY[i], this.rotationZ[i]);
            _dummy.scale.setScalar(this.drawScale[i]);

            _dummy.updateMatrix();
            this.mesh.setMatrixAt(slot, matrix);
        }

        this.mesh.count = kept;
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    /** Cosmetic draw statistics for the debug panel. */
    getDrawStats(): { alive: number; drawn: number; culled: number; peakScale: number } {
        const peakScale = getGpuChores().reduce(this.drawScale, this.count, 'max');
        return {
            alive: this.count,
            drawn: this.drawCount,
            culled: this.count - this.drawCount,
            peakScale
        };
    }
}
