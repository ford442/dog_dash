/**
 * Crystal Tarsier Guardian - a rare jeweled tarsier perched atop a crystal
 * spire. Reward creature for L1/L2: if the player approaches calmly and
 * doesn't shoot near it, it gifts a heart orb (bonus cores). If disturbed by
 * weapons fire it panics and shatters into a burst of chroma shards.
 */

import * as THREE from 'three';
// @ts-ignore
import { MeshStandardNodeMaterial } from 'three/webgpu';
// @ts-ignore
import { time, color, mix, sin, float } from 'three/tsl';

import { ParticleSystem, DebrisSystem } from './particles';
import { AudioSystem } from './audio_system';
import { CreatureInteractionResult } from './creature_types';

type GuardianState = 'idle' | 'calm' | 'blessing' | 'gifted' | 'panic' | 'gone';

/** Pulsing jeweled material used for the crystal spire and gem-fur accents. */
function createGemMaterial(baseHex: number, glowHex: number, speed: number = 1.0) {
    const mat = new MeshStandardNodeMaterial({ roughness: 0.2, metalness: 0.4 });
    const pulse = sin(time.mul(speed)).mul(0.5).add(0.5);
    mat.colorNode = mix(color(baseHex), color(glowHex), pulse.mul(0.5));
    mat.emissiveNode = color(glowHex).mul(pulse.mul(0.7).add(0.25));
    return mat;
}

export class CrystalTarsierGuardian {
    group: THREE.Group;
    position: THREE.Vector3;
    isDestroyed: boolean = false;

    private state: GuardianState = 'idle';
    private stateTimer: number = 0;
    private time: number = 0;
    private phaseOffset: number;
    private hp: number = 30;

    // Animated parts
    private headGroup: THREE.Group | null = null;
    private leftEar: THREE.Mesh | null = null;
    private rightEar: THREE.Mesh | null = null;
    private heartOrb: THREE.Group | null = null;
    private spireTip: THREE.Mesh | null = null;

    readonly RADIUS = 2.2;
    readonly CALM_DISTANCE = 22;     // player must be within this range to start calming
    readonly TOO_CLOSE = 4;          // colliding/too aggressive - cancel calm
    readonly BLESS_TIME = 3.0;       // seconds of calm proximity needed for a blessing
    readonly GIFT_CORES = 20;

    constructor(scene: THREE.Scene, x: number, y: number, z: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.phaseOffset = Math.random() * Math.PI * 2;

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'tarsierGuardian';

        this.createMesh();
        scene.add(this.group);
    }

    private createMesh(): void {
        // --- Crystal spire perch ---
        const spireGroup = new THREE.Group();
        const spireMat = createGemMaterial(0x4488ff, 0x88ccff, 1.2);

        const baseGeo = new THREE.ConeGeometry(1.3, 3.2, 6);
        const base = new THREE.Mesh(baseGeo, spireMat);
        base.position.y = -1.6;
        spireGroup.add(base);

        // Smaller accent shards around the base
        for (let i = 0; i < 4; i++) {
            const shardGeo = new THREE.ConeGeometry(0.35, 1.1 + Math.random() * 0.6, 5);
            const shard = new THREE.Mesh(shardGeo, spireMat);
            const angle = (i / 4) * Math.PI * 2;
            shard.position.set(Math.cos(angle) * 0.9, -2.2, Math.sin(angle) * 0.9);
            shard.rotation.z = Math.cos(angle) * 0.4;
            shard.rotation.x = Math.sin(angle) * 0.4;
            spireGroup.add(shard);
        }

        // Glowing tip
        const tipGeo = new THREE.OctahedronGeometry(0.4, 0);
        this.spireTip = new THREE.Mesh(tipGeo, createGemMaterial(0xaaddff, 0xffffff, 2.0));
        this.spireTip.position.y = 0.3;
        spireGroup.add(this.spireTip);

        this.group.add(spireGroup);

        // --- Jeweled tarsier body, perched on the spire tip ---
        const tarsierGroup = new THREE.Group();
        tarsierGroup.position.y = 0.9;

        const furMat = new THREE.MeshStandardMaterial({
            color: 0x6a4fc0,
            roughness: 0.55,
            metalness: 0.25,
            emissive: 0x2a1a5a,
            emissiveIntensity: 0.3
        });

        // Body
        const bodyGeo = new THREE.SphereGeometry(0.5, 14, 14);
        const body = new THREE.Mesh(bodyGeo, furMat);
        body.scale.set(1, 1.15, 0.95);
        tarsierGroup.add(body);

        // Head
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 0.62, 0.1);
        tarsierGroup.add(this.headGroup);

        const headGeo = new THREE.SphereGeometry(0.42, 14, 14);
        const head = new THREE.Mesh(headGeo, furMat.clone());
        this.headGroup.add(head);

        // Huge gem eyes
        const eyeGeo = new THREE.SphereGeometry(0.17, 12, 12);
        const eyeMat = createGemMaterial(0x00e6ff, 0xffffff, 3.0);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.18, 0.06, 0.34);
        this.headGroup.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
        rightEye.position.set(0.18, 0.06, 0.34);
        this.headGroup.add(rightEye);

        // Crystal ears
        const earGeo = new THREE.ConeGeometry(0.16, 0.5, 6);
        const earMat = createGemMaterial(0x9966ff, 0xddbbff, 1.5);
        this.leftEar = new THREE.Mesh(earGeo, earMat);
        this.leftEar.position.set(-0.32, 0.42, 0);
        this.leftEar.rotation.z = -0.3;
        this.headGroup.add(this.leftEar);

        this.rightEar = new THREE.Mesh(earGeo, earMat.clone());
        this.rightEar.position.set(0.32, 0.42, 0);
        this.rightEar.rotation.z = 0.3;
        this.headGroup.add(this.rightEar);

        // Tail wrapped around spire
        const tailGeo = new THREE.TorusGeometry(0.55, 0.06, 6, 16, Math.PI * 1.4);
        const tail = new THREE.Mesh(tailGeo, furMat.clone());
        tail.position.set(0, -0.3, 0);
        tail.rotation.x = Math.PI / 2;
        tarsierGroup.add(tail);

        tarsierGroup.scale.setScalar(1.4);
        this.group.add(tarsierGroup);

        this.group.userData.guardian = this;
    }

    getPosition(): THREE.Vector3 {
        return this.position;
    }

    getRadius(): number {
        return this.RADIUS;
    }

    /**
     * Called externally when a player weapon projectile hits this guardian.
     * Returns true once the guardian has been fully destroyed (shattered).
     */
    takeDamage(amount: number): boolean {
        if (this.state === 'panic' || this.state === 'gone' || this.isDestroyed) return this.isDestroyed;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.state = 'panic';
            this.stateTimer = 0;
        }
        return false;
    }

    update(dt: number, playerPos: THREE.Vector3, particleSystem: ParticleSystem, debrisSystem: DebrisSystem, audioSystem: AudioSystem): CreatureInteractionResult | null {
        this.time += dt;
        this.stateTimer += dt;

        const dist = playerPos.distanceTo(this.position);
        let result: CreatureInteractionResult | null = null;

        switch (this.state) {
            case 'idle': {
                if (dist < this.CALM_DISTANCE && dist > this.TOO_CLOSE) {
                    this.state = 'calm';
                    this.stateTimer = 0;
                }
                break;
            }
            case 'calm': {
                if (dist >= this.CALM_DISTANCE || dist <= this.TOO_CLOSE) {
                    // Player left the calm zone or rammed in too aggressively - reset
                    this.state = 'idle';
                    this.stateTimer = 0;
                } else if (this.stateTimer >= this.BLESS_TIME) {
                    this.state = 'blessing';
                    this.stateTimer = 0;
                    this.spawnHeartOrb();
                    audioSystem.playMagicSequence('spell_complete');
                }
                break;
            }
            case 'blessing': {
                // Heart orb floats up and toward the player briefly, then gifted
                if (this.heartOrb) {
                    this.heartOrb.position.y += dt * 1.6;
                    this.heartOrb.rotation.y += dt * 3.0;
                    this.heartOrb.scale.setScalar(1 + Math.sin(this.stateTimer * 6) * 0.1);
                }
                if (this.stateTimer >= 1.2) {
                    this.state = 'gifted';
                    this.stateTimer = 0;
                    particleSystem.emit(this.position.clone().add(new THREE.Vector3(0, 2.5, 0)), 0xff77cc, 16, 4.0, 0.7, 1.5);
                    result = { type: 'tarsier_guardian_blessing', position: this.position.clone(), cores: this.GIFT_CORES, label: 'Crystal Guardian Blessing!' };
                }
                break;
            }
            case 'gifted': {
                // Fade the spire glow and settle back to idle (won't re-bless this run)
                if (this.heartOrb) {
                    this.heartOrb.position.y += dt * 2.5;
                    const mat = (this.heartOrb.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
                    mat.opacity = Math.max(0, mat.opacity - dt * 1.5);
                }
                if (this.stateTimer >= 1.0) {
                    this.state = 'gone';
                    if (this.heartOrb) {
                        this.group.remove(this.heartOrb);
                        this.heartOrb = null;
                    }
                }
                break;
            }
            case 'panic': {
                if (this.stateTimer < dt * 2) {
                    // Just entered panic this frame - shatter burst
                    particleSystem.emit(this.position.clone(), 0x00e6ff, 24, 6.0, 0.6, 2.0);
                    particleSystem.emit(this.position.clone(), 0x9966ff, 18, 5.0, 0.8, 1.8);
                    debrisSystem.emit(this.position.clone(), 14, 7.0, 0.6);
                    audioSystem.play('explode');
                    result = { type: 'tarsier_guardian_shatter', position: this.position.clone(), cores: Math.floor(this.GIFT_CORES * 0.4), label: 'The Guardian scattered!' };
                }
                // Rapid shake + fade
                this.group.scale.setScalar(Math.max(0, 1 - this.stateTimer * 1.2));
                if (this.stateTimer >= 0.9) {
                    this.state = 'gone';
                    this.isDestroyed = true;
                }
                break;
            }
            case 'gone':
                if (!this.isDestroyed) this.isDestroyed = true;
                break;
        }

        this.animate(dist);
        return result;
    }

    private spawnHeartOrb(): void {
        this.heartOrb = new THREE.Group();
        const orbMat = new THREE.MeshStandardMaterial({
            color: 0xff66aa,
            emissive: 0xff3388,
            emissiveIntensity: 1.2,
            transparent: true,
            opacity: 1.0,
            roughness: 0.2
        });
        const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), orbMat);
        this.heartOrb.add(orb);
        this.heartOrb.position.set(0, 1.8, 0);
        this.group.add(this.heartOrb);
    }

    private animate(distToPlayer: number): void {
        if (!this.headGroup || !this.leftEar || !this.rightEar || !this.spireTip) return;

        // Gentle idle bob for the whole creature
        this.group.position.y = this.position.y + Math.sin(this.time * 1.2 + this.phaseOffset) * 0.15;

        switch (this.state) {
            case 'idle':
                this.headGroup.rotation.y = Math.sin(this.time * 0.6 + this.phaseOffset) * 0.2;
                this.leftEar.rotation.z = -0.3 + Math.sin(this.time * 1.5) * 0.05;
                this.rightEar.rotation.z = 0.3 + Math.sin(this.time * 1.5 + 1) * 0.05;
                break;
            case 'calm':
                // Watches the player approach, ears perk up proportional to closeness
                this.headGroup.lookAt(new THREE.Vector3(0, this.headGroup.position.y, this.headGroup.position.z + (this.position.x < 0 ? 0 : 1)));
                {
                    const perk = 1 - THREE.MathUtils.clamp((distToPlayer - this.TOO_CLOSE) / (this.CALM_DISTANCE - this.TOO_CLOSE), 0, 1);
                    this.leftEar.rotation.z = -0.3 - perk * 0.4;
                    this.rightEar.rotation.z = 0.3 + perk * 0.4;
                }
                break;
            case 'blessing':
            case 'gifted':
                this.headGroup.rotation.x = -0.25;
                this.leftEar.rotation.z = -0.7 + Math.sin(this.time * 8) * 0.15;
                this.rightEar.rotation.z = 0.7 + Math.sin(this.time * 8 + 0.5) * 0.15;
                break;
            case 'panic':
                this.group.rotation.z = Math.sin(this.time * 30) * 0.3;
                break;
        }
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
