import * as THREE from 'three';
import { ParticleSystem } from './particles';
import { AudioSystem } from './audio_system';
import { CreatureInteractionResult } from './creature_types';

type PufferState = 'idle' | 'inflating' | 'puffed' | 'deflating';

interface PufferBubble {
    mesh: THREE.Mesh;
    active: boolean;
    drift: THREE.Vector3;
}

/**
 * Nebula Puffer — a round, spiky-but-cute drifter that puffs up when approached.
 * Rewards slow, gentle flybys with cataloging, graze-window memory, and poppable bubbles.
 */
export class PuffPuffer {
    group: THREE.Group;
    position: THREE.Vector3;
    isDestroyed = false;

    private time = 0;
    private state: PufferState = 'idle';
    private stateTimer = 0;
    private calmTimer = 0;
    private inflateT = 0;
    private hasCataloged = false;
    private spinePopCooldown = 0;
    private lastPlayerPos = new THREE.Vector3();
    private hasLastPlayer = false;

    private bodyGroup: THREE.Group;
    private spikesGroup: THREE.Group;
    private leftEye: THREE.Mesh;
    private rightEye: THREE.Mesh;
    private leftCheek: THREE.Mesh;
    private rightCheek: THREE.Mesh;
    private bubbles: PufferBubble[] = [];
    private bubbleGroup: THREE.Group;

    readonly CALM_DISTANCE = 10;
    readonly TOO_CLOSE = 3.8;
    readonly CALM_SPEED = 11;
    readonly FAST_SPEED = 16;
    readonly INFLATE_DURATION = 0.8;
    readonly PUFF_HOLD = 0.55;
    readonly DEFLATE_DURATION = 0.7;
    readonly GRAZE_BONUS_DURATION = 8;
    readonly GRAZE_BONUS_DIST = 0.55;

    constructor(scene: THREE.Scene, x: number, y: number, z: number, tintColor?: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'nebulaPuffer';

        const bodyColor = tintColor ?? 0xffbb88;
        const bodyMat = new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.75,
            metalness: 0.05,
            emissive: bodyColor,
            emissiveIntensity: 0.12
        });
        const spikeMat = new THREE.MeshStandardMaterial({
            color: 0xffeedd,
            roughness: 0.6,
            emissive: 0xffccaa,
            emissiveIntensity: 0.15
        });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.2 });

        this.bodyGroup = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), bodyMat);
        this.bodyGroup.add(body);

        this.spikesGroup = new THREE.Group();
        const spikeCount = 10;
        for (let i = 0; i < spikeCount; i++) {
            const phi = Math.acos(1 - 2 * (i + 0.5) / spikeCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), spikeMat);
            spike.position.set(
                Math.sin(phi) * Math.cos(theta) * 0.52,
                Math.sin(phi) * Math.sin(theta) * 0.52,
                Math.cos(phi) * 0.52
            );
            spike.lookAt(
                spike.position.x * 2,
                spike.position.y * 2,
                spike.position.z * 2
            );
            spike.rotateX(Math.PI / 2);
            this.spikesGroup.add(spike);
        }
        this.bodyGroup.add(this.spikesGroup);

        const faceGroup = new THREE.Group();
        faceGroup.position.set(0, 0.08, 0.42);

        this.leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
        this.leftEye.position.set(-0.14, 0.06, 0);
        faceGroup.add(this.leftEye);

        this.rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
        this.rightEye.position.set(0.14, 0.06, 0);
        faceGroup.add(this.rightEye);

        const cheekMat = new THREE.MeshStandardMaterial({
            color: 0xff99aa,
            roughness: 0.8,
            transparent: true,
            opacity: 0.55
        });
        this.leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), cheekMat);
        this.leftCheek.position.set(-0.22, -0.04, 0.02);
        this.leftCheek.scale.set(1, 0.7, 0.5);
        faceGroup.add(this.leftCheek);

        this.rightCheek = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), cheekMat);
        this.rightCheek.position.set(0.22, -0.04, 0.02);
        this.rightCheek.scale.set(1, 0.7, 0.5);
        faceGroup.add(this.rightCheek);

        const mouth = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0x553322, roughness: 0.5 })
        );
        mouth.position.set(0, -0.1, 0.04);
        mouth.scale.set(1.4, 0.6, 0.8);
        faceGroup.add(mouth);

        this.bodyGroup.add(faceGroup);
        this.group.add(this.bodyGroup);

        this.bubbleGroup = new THREE.Group();
        this.group.add(this.bubbleGroup);

        const glow = new THREE.PointLight(bodyColor, 0.35, 5);
        glow.position.set(0, 0.2, 0.3);
        this.bodyGroup.add(glow);

        scene.add(this.group);
    }

    getPosition(): THREE.Vector3 {
        return this.position;
    }

    getRadius(): number {
        return 0.55 + this.inflateT * 0.35;
    }

    private getApproachSpeed(playerPos: THREE.Vector3, dt: number): number {
        if (!this.hasLastPlayer || dt <= 0) return 0;
        return playerPos.distanceTo(this.lastPlayerPos) / dt;
    }

    private applyBodyScale(scale: number): void {
        this.bodyGroup.scale.setScalar(scale);
        const cheekScale = 1 + (scale - 1) * 0.8;
        this.leftCheek.scale.set(cheekScale, cheekScale * 0.7, cheekScale * 0.5);
        this.rightCheek.scale.set(cheekScale, cheekScale * 0.7, cheekScale * 0.5);
        const eyeScale = 1 + (scale - 1) * 0.45;
        this.leftEye.scale.setScalar(eyeScale);
        this.rightEye.scale.setScalar(eyeScale);
        for (const child of this.spikesGroup.children) {
            if (child instanceof THREE.Mesh) {
                const dir = child.position.clone().normalize();
                child.position.copy(dir.multiplyScalar(0.52 + (scale - 1) * 0.38));
                child.scale.set(1, 1 + (scale - 1) * 0.9, 1);
            }
        }
    }

    private spawnBubbleRing(): void {
        const bubbleMat = new THREE.MeshPhysicalMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.45,
            roughness: 0.05,
            metalness: 0,
            transmission: 0.85,
            thickness: 0.1
        });
        const count = 7;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), bubbleMat.clone());
            mesh.position.set(Math.cos(angle) * 0.9, Math.sin(angle) * 0.5, 0.1);
            this.bubbleGroup.add(mesh);
            this.bubbles.push({
                mesh,
                active: true,
                drift: new THREE.Vector3(
                    Math.cos(angle) * 0.4,
                    Math.sin(angle) * 0.25,
                    (Math.random() - 0.5) * 0.2
                )
            });
        }
    }

    private clearBubbles(): void {
        for (const b of this.bubbles) {
            this.bubbleGroup.remove(b.mesh);
            b.mesh.geometry.dispose();
            (b.mesh.material as THREE.Material).dispose();
        }
        this.bubbles = [];
    }

    private animateIdle(): void {
        const breath = 1 + Math.sin(this.time * 2.2) * 0.04;
        this.applyBodyScale(breath);
        this.inflateT = (breath - 1) / 0.6;
    }

    update(
        dt: number,
        playerPos: THREE.Vector3,
        particleSystem?: ParticleSystem,
        _debrisSystem?: unknown,
        audioSystem?: AudioSystem
    ): CreatureInteractionResult | null {
        this.time += dt;
        this.stateTimer += dt;
        this.spinePopCooldown = Math.max(0, this.spinePopCooldown - dt);

        const dist = this.position.distanceTo(playerPos);
        const approachSpeed = this.getApproachSpeed(playerPos, dt);
        let result: CreatureInteractionResult | null = null;
        let bubbleScore = 0;

        // Lazy drift
        this.position.x -= dt * 0.65;
        this.position.y += Math.sin(this.time * 0.9) * dt * 0.15;
        this.group.position.copy(this.position);
        this.group.rotation.z = Math.sin(this.time * 0.7) * 0.06;

        // Fast flyby — harmless spine puff (no damage)
        if (
            dist < this.TOO_CLOSE + 1.5 &&
            approachSpeed > this.FAST_SPEED &&
            this.spinePopCooldown <= 0 &&
            this.state === 'idle'
        ) {
            this.spinePopCooldown = 1.2;
            const puffPos = this.position.clone();
            particleSystem?.emit(puffPos, 0xffeedd, 8, 3.0, 0.4, 0.8);
            particleSystem?.emit(puffPos, 0xffffff, 5, 2.0, 0.3, 0.5);
            audioSystem?.play('sparkle', 0.25);
        }

        switch (this.state) {
            case 'idle': {
                this.animateIdle();
                if (!this.hasCataloged && dist < this.CALM_DISTANCE && dist > this.TOO_CLOSE && approachSpeed < this.CALM_SPEED) {
                    this.calmTimer += dt;
                    if (this.calmTimer >= 1.0) {
                        this.state = 'inflating';
                        this.stateTimer = 0;
                    }
                } else {
                    this.calmTimer = 0;
                }
                if (dist > this.CALM_DISTANCE + 6) {
                    this.hasCataloged = false;
                }
                break;
            }
            case 'inflating': {
                const t = Math.min(1, this.stateTimer / this.INFLATE_DURATION);
                const scale = THREE.MathUtils.lerp(1, 1.6, t);
                this.applyBodyScale(scale);
                this.inflateT = t;
                if (t >= 1) {
                    this.state = 'puffed';
                    this.stateTimer = 0;
                    this.spawnBubbleRing();
                    audioSystem?.play('heart_pop', 0.45);
                }
                break;
            }
            case 'puffed': {
                this.applyBodyScale(1.6);
                this.inflateT = 1;
                if (this.stateTimer < dt * 2) {
                    result = {
                        type: 'puff_puffer_catalog',
                        position: this.position.clone(),
                        grazeWindowDuration: this.GRAZE_BONUS_DURATION,
                        grazeWindowBonus: this.GRAZE_BONUS_DIST,
                        label: 'Nebula Puffer!'
                    };
                    this.hasCataloged = true;
                }
                if (this.stateTimer >= this.PUFF_HOLD) {
                    this.state = 'deflating';
                    this.stateTimer = 0;
                }
                break;
            }
            case 'deflating': {
                const t = Math.min(1, this.stateTimer / this.DEFLATE_DURATION);
                const scale = THREE.MathUtils.lerp(1.6, 1, t);
                this.applyBodyScale(scale);
                this.inflateT = 1 - t;
                if (this.stateTimer < dt * 2) {
                    particleSystem?.emit(this.position.clone(), 0xccddff, 10, 2.5, 0.35, 0.9);
                    particleSystem?.emit(this.position.clone(), 0xffffff, 6, 1.8, 0.25, 0.6);
                    audioSystem?.play('sparkle', 0.3);
                }
                if (t >= 1) {
                    this.state = 'idle';
                    this.stateTimer = 0;
                    this.clearBubbles();
                }
                break;
            }
        }

        // Poppable friendly bubbles while puffed or deflating early
        if (this.state === 'puffed' || (this.state === 'deflating' && this.stateTimer < 0.4)) {
            for (const bubble of this.bubbles) {
                if (!bubble.active) continue;
                bubble.mesh.position.addScaledVector(bubble.drift, dt);
                const wobble = 1 + Math.sin(this.time * 5 + bubble.mesh.position.x) * 0.08;
                bubble.mesh.scale.setScalar(wobble);

                const worldPos = bubble.mesh.getWorldPosition(new THREE.Vector3());
                if (worldPos.distanceTo(playerPos) < 1.4) {
                    bubble.active = false;
                    bubble.mesh.visible = false;
                    bubbleScore += 8;
                    particleSystem?.emit(worldPos, 0xaaddff, 5, 2.0, 0.3, 0.5);
                    audioSystem?.play('twinkle', 0.35);
                }
            }
        }

        if (bubbleScore > 0 && !result) {
            result = {
                type: 'puff_puffer_bubble_pop',
                position: playerPos.clone(),
                score: bubbleScore,
                label: `+${bubbleScore}`
            };
        } else if (bubbleScore > 0 && result) {
            result.score = (result.score ?? 0) + bubbleScore;
        }

        this.lastPlayerPos.copy(playerPos);
        this.hasLastPlayer = true;
        return result;
    }

    destroy(scene: THREE.Scene): void {
        this.clearBubbles();
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
        this.isDestroyed = true;
    }
}
