/**
 * Living Geode Titan - a massive hollow floating geode that drifts slowly
 * across L2/L5. The player can fly safely through its open hollow for a
 * scan/cores bonus, or shoot its crystalline rim to shatter it for a bigger
 * burst of bonus geodes + a memory fragment.
 */

import * as THREE from 'three';
// @ts-ignore
import { MeshStandardNodeMaterial } from 'three/webgpu';
// @ts-ignore
import { time, color, mix, sin, positionLocal, normalLocal, float } from 'three/tsl';

import { ParticleSystem, DebrisSystem } from './particles';
import { AudioSystem } from './audio_system';
import { CreatureInteractionResult } from './creature_types';

type TitanPhase = 'dormant' | 'shattering' | 'destroyed';

/** Crystalline shell material - slow color drift + rim glow via TSL. */
function createGeodeShellMaterial(): any {
    const mat = new MeshStandardNodeMaterial({
        roughness: 0.25,
        metalness: 0.5,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide
    });
    const pulse = sin(time.mul(0.8)).mul(0.5).add(0.5);
    const inner = color(0x8855ff);
    const outer = color(0x44ddff);
    mat.colorNode = mix(inner, outer, pulse);
    mat.emissiveNode = mix(color(0x442288), color(0x22aaff), pulse).mul(0.6);
    return mat;
}

/** Pulsing core crystal material. */
function createCoreMaterial(): any {
    const mat = new MeshStandardNodeMaterial({ roughness: 0.1, metalness: 0.2 });
    const pulse = sin(time.mul(2.5)).mul(0.5).add(0.5);
    mat.colorNode = mix(color(0xffaaff), color(0xffffff), pulse);
    mat.emissiveNode = color(0xff66ff).mul(pulse.mul(0.8).add(0.4));
    return mat;
}

export class LivingGeodeTitan {
    group: THREE.Group;
    position: THREE.Vector3;
    isDestroyed: boolean = false;

    private phase: TitanPhase = 'dormant';
    private phaseTimer: number = 0;
    private time: number = 0;
    private hp: number = 120;
    private flythroughGiven: boolean = false;

    private shell: THREE.Mesh | null = null;
    private core: THREE.Mesh | null = null;
    private innerCrystals: THREE.Mesh[] = [];

    readonly OUTER_RADIUS = 9;
    readonly HOLLOW_RADIUS = 4.5; // player inside this radius is "through" the geode
    readonly FLYTHROUGH_CORES = 25;
    readonly SHATTER_CORES = 50;

    constructor(scene: THREE.Scene, x: number, y: number, z: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.createMesh();
        scene.add(this.group);
    }

    private createMesh(): void {
        // --- Outer shell: a sphere with a wedge-shaped opening (the geode's hollow mouth) ---
        const shellGeo = new THREE.SphereGeometry(
            this.OUTER_RADIUS, 24, 16,
            0, Math.PI * 1.5,   // phiStart, phiLength - leaves a 90deg gap
            0, Math.PI
        );
        this.shell = new THREE.Mesh(shellGeo, createGeodeShellMaterial());
        this.group.add(this.shell);

        // --- Inner crystal cluster, lining the inside of the hollow ---
        const crystalMat = createGeodeShellMaterial();
        for (let i = 0; i < 14; i++) {
            const len = 1.2 + Math.random() * 2.5;
            const geo = new THREE.ConeGeometry(0.5 + Math.random() * 0.6, len, 6);
            const crystal = new THREE.Mesh(geo, crystalMat.clone());

            // Scatter on the inner shell surface, pointing inward toward center
            const phi = Math.random() * Math.PI * 1.5;
            const theta = Math.random() * Math.PI;
            const r = this.OUTER_RADIUS * 0.85;
            const px = r * Math.sin(theta) * Math.cos(phi);
            const py = r * Math.cos(theta);
            const pz = r * Math.sin(theta) * Math.sin(phi);
            crystal.position.set(px, py, pz);
            crystal.lookAt(0, 0, 0);
            crystal.rotateX(Math.PI / 2);

            this.innerCrystals.push(crystal);
            this.group.add(crystal);
        }

        // --- Glowing core ---
        const coreGeo = new THREE.IcosahedronGeometry(1.6, 1);
        this.core = new THREE.Mesh(coreGeo, createCoreMaterial());
        this.group.add(this.core);

        this.group.userData.geodeTitan = this;
    }

    getPosition(): THREE.Vector3 {
        return this.position;
    }

    getRadius(): number {
        return this.OUTER_RADIUS;
    }

    /**
     * Called externally when a player weapon projectile hits the shell.
     * Returns true once the titan has fully shattered and can be removed.
     */
    takeDamage(amount: number): boolean {
        if (this.phase !== 'dormant') return this.phase === 'destroyed';
        this.hp -= amount;
        if (this.hp <= 0) {
            this.phase = 'shattering';
            this.phaseTimer = 0;
        }
        return false;
    }

    update(dt: number, playerPos: THREE.Vector3, particleSystem: ParticleSystem, debrisSystem: DebrisSystem, audioSystem: AudioSystem): CreatureInteractionResult | null {
        this.time += dt;
        this.phaseTimer += dt;
        let result: CreatureInteractionResult | null = null;

        switch (this.phase) {
            case 'dormant': {
                // Slow majestic tumble
                this.group.rotation.y += dt * 0.08;
                this.group.rotation.x += dt * 0.02;
                if (this.core) {
                    this.core.rotation.y -= dt * 0.5;
                    this.core.rotation.x += dt * 0.3;
                }

                // Flythrough check: player drifted near the hollow center
                if (!this.flythroughGiven) {
                    const dist = playerPos.distanceTo(this.position);
                    if (dist < this.HOLLOW_RADIUS) {
                        this.flythroughGiven = true;
                        particleSystem.emit(this.position.clone(), 0xaaffff, 30, 5.0, 1.0, 4.0);
                        audioSystem.playMagicSequence('spell_complete');
                        result = {
                            type: 'geode_titan_flythrough',
                            position: this.position.clone(),
                            cores: this.FLYTHROUGH_CORES,
                            label: 'Threaded the Geode!'
                        };
                    }
                }
                break;
            }
            case 'shattering': {
                if (this.phaseTimer < dt * 2) {
                    // First shatter frame: huge burst
                    particleSystem.emit(this.position.clone(), 0x8855ff, 40, 7.0, 1.2, 6.0);
                    particleSystem.emit(this.position.clone(), 0x44ddff, 40, 7.0, 1.0, 6.0);
                    particleSystem.emit(this.position.clone(), 0xff66ff, 24, 8.0, 1.4, 3.0);
                    debrisSystem.emit(this.position.clone(), 30, 9.0, 1.2);
                    audioSystem.play('explode');
                    result = {
                        type: 'geode_titan_shatter',
                        position: this.position.clone(),
                        cores: this.SHATTER_CORES,
                        label: 'Geode Titan Shattered!'
                    };
                }

                // Shell fragments fly apart, core dims
                const t = this.phaseTimer;
                this.group.scale.setScalar(Math.max(0, 1 + t * 0.6));
                if (this.shell && this.shell.material instanceof THREE.Material) {
                    (this.shell.material as any).opacity = Math.max(0, 0.55 - t * 0.7);
                }
                this.innerCrystals.forEach((c, i) => {
                    c.position.multiplyScalar(1 + dt * (1.5 + (i % 5) * 0.3));
                    c.rotation.x += dt * 4;
                });
                if (this.core) {
                    this.core.scale.setScalar(Math.max(0, 1 - t * 1.2));
                }

                if (this.phaseTimer >= 1.0) {
                    this.phase = 'destroyed';
                    this.isDestroyed = true;
                }
                break;
            }
            case 'destroyed':
                this.isDestroyed = true;
                break;
        }

        return result;
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.group);
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    }
}
