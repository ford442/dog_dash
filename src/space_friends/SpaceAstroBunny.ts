import * as THREE from 'three';
import type { InteractionResult } from './types';

type AstroBunnyState = 'idle' | 'excited' | 'celebrating';

const BUBBLE_HELMET_MAT = new THREE.MeshPhysicalMaterial({
    color: 0xaaddff,
    transmission: 0.9,
    roughness: 0.05,
    transparent: true,
    opacity: 0.28,
    thickness: 0.08
});

export class SpaceAstroBunny {
    group: THREE.Group;
    position: THREE.Vector3;
    baseY: number;

    time = 0;
    state: AstroBunnyState = 'idle';
    stateTimer = 0;
    hopPhase = 0;
    earTwitchTimer = 0;
    hasGreeted = false;
    sparkleCooldown = 0;

    private animGroup: THREE.Group | null = null;
    private bodyGroup: THREE.Group | null = null;
    private leftEar: THREE.Group | null = null;
    private rightEar: THREE.Group | null = null;
    private leftRocket: THREE.Mesh | null = null;
    private rightRocket: THREE.Mesh | null = null;

    readonly INTERACTION_DISTANCE = 9;
    readonly LUCKY_STAR_BONUS = 8;

    constructor(scene: THREE.Scene, x: number, y: number) {
        this.position = new THREE.Vector3(x, y, 0);
        this.baseY = y;
        this.hopPhase = Math.random() * Math.PI * 2;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'astroBunny';

        this.createMesh();
        scene.add(this.group);
    }

    private createMesh(): void {
        this.animGroup = new THREE.Group();
        this.bodyGroup = new THREE.Group();

        const furMat = new THREE.MeshStandardMaterial({
            color: 0xfff0f5,
            roughness: 0.88,
            metalness: 0.04
        });
        const innerEarMat = new THREE.MeshStandardMaterial({
            color: 0xffb6c1,
            roughness: 0.9
        });
        const rocketMat = new THREE.MeshStandardMaterial({
            color: 0xff8844,
            emissive: 0xff6622,
            emissiveIntensity: 0.45,
            roughness: 0.45
        });

        const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), furMat);
        body.scale.set(1, 0.92, 0.88);
        this.bodyGroup.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12), furMat);
        head.position.set(0, 0.28, 0.1);
        this.bodyGroup.add(head);

        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x443355, roughness: 0.2 });
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
            eye.position.set(0.1 * side, 0.32, 0.28);
            this.bodyGroup.add(eye);
            const shine = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 6, 6),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            shine.position.set(0.12 * side, 0.35, 0.31);
            this.bodyGroup.add(shine);
        }

        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xff99aa, roughness: 0.5 })
        );
        nose.position.set(0, 0.22, 0.36);
        this.bodyGroup.add(nose);

        this.leftEar = new THREE.Group();
        this.leftEar.position.set(-0.18, 0.48, 0.05);
        const leftEarMesh = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.38, 8), furMat);
        leftEarMesh.position.y = 0.18;
        this.leftEar.add(leftEarMesh);
        const leftInner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 8), innerEarMat);
        leftInner.position.set(0, 0.18, 0.03);
        this.leftEar.add(leftInner);
        this.leftRocket = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), rocketMat);
        this.leftRocket.position.set(0, 0.42, 0);
        this.leftRocket.rotation.x = Math.PI;
        this.leftEar.add(this.leftRocket);
        this.bodyGroup.add(this.leftEar);

        this.rightEar = new THREE.Group();
        this.rightEar.position.set(0.18, 0.48, 0.05);
        const rightEarMesh = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.38, 8), furMat);
        rightEarMesh.position.y = 0.18;
        this.rightEar.add(rightEarMesh);
        const rightInner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 8), innerEarMat);
        rightInner.position.set(0, 0.18, 0.03);
        this.rightEar.add(rightInner);
        this.rightRocket = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), rocketMat);
        this.rightRocket.position.set(0, 0.42, 0);
        this.rightRocket.rotation.x = Math.PI;
        this.rightEar.add(this.rightRocket);
        this.bodyGroup.add(this.rightEar);

        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 14), BUBBLE_HELMET_MAT);
        bubble.position.set(0, 0.22, 0.05);
        this.bodyGroup.add(bubble);

        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(0.62, 0.025, 6, 18),
            new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.45, roughness: 0.35 })
        );
        rim.position.set(0, 0.22, 0.05);
        rim.rotation.y = Math.PI / 2;
        this.bodyGroup.add(rim);

        this.animGroup.add(this.bodyGroup);
        this.group.add(this.animGroup);
        this.group.userData.astroBunny = this;
    }

    private animateIdle(dt: number): void {
        this.hopPhase += dt * 2.4;
        const hop = Math.abs(Math.sin(this.hopPhase)) * 0.28;
        if (this.animGroup) {
            this.animGroup.position.y = hop;
            this.animGroup.rotation.z = Math.sin(this.time * 0.8) * 0.04;
        }

        this.earTwitchTimer += dt;
        if (this.earTwitchTimer >= 2.8 + Math.sin(this.time) * 0.5) {
            this.earTwitchTimer = 0;
        }
        const twitch = this.earTwitchTimer < 0.18 ? 0.35 : 0;
        if (this.leftEar) this.leftEar.rotation.z = 0.12 + twitch;
        if (this.rightEar) this.rightEar.rotation.z = -0.12 - twitch;
        if (this.leftRocket) this.leftRocket.scale.y = 1;
        if (this.rightRocket) this.rightRocket.scale.y = 1;
    }

    private animateExcited(): void {
        const t = this.stateTimer;
        const hop1 = Math.max(0, Math.sin(t * 14) * Math.exp(-t * 2.5));
        const hop2 = Math.max(0, Math.sin((t - 0.35) * 14) * Math.exp(-(t - 0.35) * 2.8));
        const hopY = (hop1 + hop2) * 0.55;

        if (this.animGroup) {
            this.animGroup.position.y = hopY;
            this.animGroup.scale.setScalar(1 + hopY * 0.08);
        }

        const flare = 0.55 + Math.sin(t * 22) * 0.25;
        if (this.leftEar) {
            this.leftEar.rotation.z = flare;
            this.leftEar.rotation.x = -0.15;
        }
        if (this.rightEar) {
            this.rightEar.rotation.z = -flare;
            this.rightEar.rotation.x = -0.15;
        }
        if (this.leftRocket) this.leftRocket.scale.y = 1.2 + hopY * 2;
        if (this.rightRocket) this.rightRocket.scale.y = 1.2 + hopY * 2;
    }

    update(dt: number, playerPos: THREE.Vector3, disturbed = false): InteractionResult | null {
        this.time += dt;
        this.stateTimer += dt;
        this.sparkleCooldown = Math.max(0, this.sparkleCooldown - dt);

        const dist = this.position.distanceTo(playerPos);
        let result: InteractionResult | null = null;

        if (!disturbed && dist < this.INTERACTION_DISTANCE) {
            if (this.state === 'idle') {
                this.state = 'excited';
                this.stateTimer = 0;
            }

            if (this.state === 'excited') {
                this.animateExcited();
                if (this.sparkleCooldown <= 0 && this.stateTimer > 0.15 && this.stateTimer < 0.9) {
                    this.sparkleCooldown = 0.25;
                    const puff = this.position.clone();
                    puff.y += 0.4;
                    result = { type: 'astro_bunny_sparkle', position: puff };
                }
                if (this.stateTimer >= 0.85 && !this.hasGreeted) {
                    this.state = 'celebrating';
                    this.stateTimer = 0;
                    this.hasGreeted = true;
                    result = {
                        type: 'astro_bunny_lucky',
                        position: this.position.clone(),
                        bonus: this.LUCKY_STAR_BONUS
                    };
                }
            } else if (this.state === 'celebrating') {
                this.animateExcited();
                if (this.stateTimer >= 1.2) {
                    this.state = 'idle';
                    this.stateTimer = 0;
                }
            }
        } else {
            this.state = 'idle';
            this.stateTimer = 0;
            if (dist > this.INTERACTION_DISTANCE + 5) {
                this.hasGreeted = false;
            }
        }

        if (this.state === 'idle') {
            this.animateIdle(dt);
        }

        this.group.position.y = this.baseY + Math.sin(this.time * 1.1) * 0.06;

        return result;
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.group);
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
                child.geometry?.dispose();
                if (child.material && child.material !== BUBBLE_HELMET_MAT) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }

    getDistanceToPlayer(playerPos: THREE.Vector3): number {
        return this.position.distanceTo(playerPos);
    }
}
