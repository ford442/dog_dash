import * as THREE from 'three';
import type { InteractionResult } from './types';

type OtterGiftState = 'juggling' | 'preparing' | 'orb_flying' | 'waving' | 'done';

interface JuggleOrb {
    mesh: THREE.Mesh;
    light: THREE.PointLight;
    phase: number;
    color: number;
    /** World offset from otter centre while juggling. */
    localPos: THREE.Vector3;
    /** True while this orb is the gift flying toward the player. */
    isGift?: boolean;
}

export class SpaceOtter {
    group: THREE.Group;
    position: THREE.Vector3;
    baseY: number;

    time: number = 0;
    giftState: OtterGiftState = 'juggling';
    giftTimer: number = 0;
    calmTimer: number = 0;
    hasGifted: boolean = false;
    splooshTimer: number = 0;

    private bodyGroup: THREE.Group | null = null;
    private headGroup: THREE.Group | null = null;
    private tailGroup: THREE.Group | null = null;
    private leftArm: THREE.Group | null = null;
    private rightArm: THREE.Group | null = null;
    private leftPaw: THREE.Group | null = null;
    private rightPaw: THREE.Group | null = null;
    private orbsGroup: THREE.Group | null = null;
    private orbs: JuggleOrb[] = [];
    private giftOrb: JuggleOrb | null = null;
    private giftStart = new THREE.Vector3();
    private giftTarget = new THREE.Vector3();

    readonly INTERACTION_DISTANCE = 9;
    readonly GIFT_CORES = 1;
    readonly JUGGLE_SPEED = 2.8;
    readonly FLOAT_AMPLITUDE = 0.45;
    readonly FLOAT_SPEED = 1.4;

    constructor(scene: THREE.Scene, x: number, y: number) {
        this.position = new THREE.Vector3(x, y, 0);
        this.baseY = y;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'cosmicOtter';

        this.createMesh();
        scene.add(this.group);
    }

    private createMesh(): void {
        const otterGroup = new THREE.Group();
        this.bodyGroup = otterGroup;

        const furMat = new THREE.MeshStandardMaterial({
            color: 0x8b6914,
            roughness: 0.85,
            metalness: 0.05
        });
        const bellyMat = new THREE.MeshStandardMaterial({
            color: 0xf5e6c8,
            roughness: 0.9
        });

        // Streamlined body
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), furMat);
        body.scale.set(1.15, 0.75, 0.85);
        otterGroup.add(body);

        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 14), bellyMat);
        belly.position.set(0, -0.08, 0.12);
        belly.scale.set(0.9, 0.7, 0.5);
        otterGroup.add(belly);

        // Head
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 0.22, 0.28);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 14), furMat);
        this.headGroup.add(head);

        // Tiny rounded ears
        const earGeo = new THREE.SphereGeometry(0.09, 8, 8);
        for (const side of [-1, 1]) {
            const ear = new THREE.Mesh(earGeo, furMat);
            ear.position.set(0.2 * side, 0.22, 0.02);
            ear.scale.set(0.8, 1.0, 0.5);
            this.headGroup.add(ear);
        }

        // Big friendly eyes
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.2 });
        for (const side of [-1, 1]) {
            const eyeGroup = new THREE.Group();
            eyeGroup.position.set(0.11 * side, 0.04, 0.26);
            eyeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), eyeWhiteMat));
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), pupilMat);
            pupil.position.z = 0.06;
            eyeGroup.add(pupil);
            const shine = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 6, 6),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            shine.position.set(0.02, 0.02, 0.08);
            eyeGroup.add(shine);
            this.headGroup.add(eyeGroup);
        }

        // Small nose
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.5 })
        );
        nose.position.set(0, -0.04, 0.3);
        this.headGroup.add(nose);

        otterGroup.add(this.headGroup);

        // Arms (for juggling reach)
        this.leftArm = new THREE.Group();
        this.leftArm.position.set(-0.38, 0.05, 0.1);
        this.leftPaw = new THREE.Group();
        this.leftPaw.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), furMat));
        this.leftPaw.position.set(-0.12, 0.15, 0.05);
        this.leftArm.add(this.leftPaw);
        otterGroup.add(this.leftArm);

        this.rightArm = new THREE.Group();
        this.rightArm.position.set(0.38, 0.05, 0.1);
        this.rightPaw = new THREE.Group();
        this.rightPaw.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), furMat));
        this.rightPaw.position.set(0.12, 0.15, 0.05);
        this.rightArm.add(this.rightPaw);
        otterGroup.add(this.rightArm);

        // Fluffy tail for balance
        this.tailGroup = new THREE.Group();
        this.tailGroup.position.set(0, -0.05, -0.42);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.55, 4, 8), furMat);
        tail.rotation.x = 0.6;
        this.tailGroup.add(tail);
        otterGroup.add(this.tailGroup);

        // Juggling orbs
        this.orbsGroup = new THREE.Group();
        this.orbsGroup.position.y = 0.35;
        const orbColors = [0x44ddff, 0xff66cc, 0xffdd44, 0x66ffee];
        for (let i = 0; i < 4; i++) {
            const orbColor = orbColors[i];
            const orbMat = new THREE.MeshStandardMaterial({
                color: orbColor,
                emissive: orbColor,
                emissiveIntensity: 1.2,
                roughness: 0.15,
                metalness: 0.3
            });
            const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), orbMat);
            const light = new THREE.PointLight(orbColor, 0.6, 3);
            orbMesh.add(light);
            this.orbsGroup.add(orbMesh);
            this.orbs.push({
                mesh: orbMesh,
                light,
                phase: (i / 4) * Math.PI * 2,
                color: orbColor,
                localPos: new THREE.Vector3()
            });
        }
        otterGroup.add(this.orbsGroup);

        const ambientLight = new THREE.PointLight(0xaaddff, 0.35, 5);
        ambientLight.position.set(0, 0.4, 0.3);
        otterGroup.add(ambientLight);

        this.group.add(otterGroup);
        this.group.userData.otter = this;
    }

    private updateJugglePositions(speedMul: number = 1): void {
        if (!this.orbsGroup) return;
        const t = this.time * this.JUGGLE_SPEED * speedMul;
        for (const orb of this.orbs) {
            if (orb.isGift) continue;
            const phase = t + orb.phase;
            // Figure-8 toss path in local space
            orb.localPos.set(
                Math.sin(phase) * 0.55,
                Math.sin(phase * 2) * 0.28 + 0.15,
                Math.cos(phase) * 0.35
            );
            orb.mesh.position.copy(orb.localPos);
            orb.mesh.rotation.y += 0.04;
        }
    }

    private aimArmsAtOrbs(): void {
        if (!this.leftPaw || !this.rightPaw || this.orbs.length < 2) return;
        const t = this.time * this.JUGGLE_SPEED;
        const leftIdx = Math.floor(t / Math.PI) % this.orbs.length;
        const rightIdx = (leftIdx + 2) % this.orbs.length;
        const leftOrb = this.orbs[leftIdx];
        const rightOrb = this.orbs[rightIdx];
        if (!leftOrb.isGift) {
            this.leftPaw.position.set(
                leftOrb.localPos.x - 0.25,
                leftOrb.localPos.y - 0.05,
                leftOrb.localPos.z
            );
        }
        if (!rightOrb.isGift) {
            this.rightPaw.position.set(
                rightOrb.localPos.x + 0.25,
                rightOrb.localPos.y - 0.05,
                rightOrb.localPos.z
            );
        }
    }

    update(dt: number, playerPos: THREE.Vector3, disturbed: boolean = false): InteractionResult | null {
        this.time += dt;
        let result: InteractionResult | null = null;

        const dist = this.position.distanceTo(playerPos);
        const floatY = Math.sin(this.time * this.FLOAT_SPEED) * this.FLOAT_AMPLITUDE;
        this.group.position.y = this.baseY + floatY;
        this.group.rotation.z = Math.sin(this.time * 0.9) * 0.08;

        if (this.tailGroup) {
            const tailSwish = this.giftState === 'waving' ? 0.35 : 0.18;
            this.tailGroup.rotation.y = Math.sin(this.time * 4) * tailSwish;
            this.tailGroup.rotation.x = 0.6 + Math.sin(this.time * 3) * 0.1;
        }

        // Periodic water-splash sparkle while juggling
        this.splooshTimer += dt;
        if (this.giftState === 'juggling' && this.splooshTimer >= 2.2) {
            this.splooshTimer = 0;
            result = { type: 'otter_sploosh', position: this.position.clone() };
        }

        switch (this.giftState) {
            case 'juggling': {
                this.updateJugglePositions(1);
                this.aimArmsAtOrbs();

                if (!this.hasGifted && !disturbed && dist < this.INTERACTION_DISTANCE) {
                    this.calmTimer += dt;
                    if (this.calmTimer >= 0.9) {
                        this.giftState = 'preparing';
                        this.giftTimer = 0;
                    }
                } else if (disturbed || dist >= this.INTERACTION_DISTANCE) {
                    this.calmTimer = 0;
                }
                break;
            }
            case 'preparing': {
                // Slow the juggle while deciding to share
                this.updateJugglePositions(0.35);
                this.aimArmsAtOrbs();
                this.giftTimer += dt;
                if (disturbed || dist > this.INTERACTION_DISTANCE + 1) {
                    this.giftState = 'juggling';
                    this.giftTimer = 0;
                    this.calmTimer = 0;
                    break;
                }
                if (this.giftTimer >= 0.6) {
                    this.giftOrb = this.orbs[0];
                    this.giftOrb.isGift = true;
                    this.giftStart.copy(this.giftOrb.mesh.getWorldPosition(new THREE.Vector3()));
                    this.giftTarget.copy(playerPos);
                    this.giftState = 'orb_flying';
                    this.giftTimer = 0;
                }
                break;
            }
            case 'orb_flying': {
                this.updateJugglePositions(0.5);
                // Celebratory toss on remaining orbs
                for (let i = 1; i < this.orbs.length; i++) {
                    const orb = this.orbs[i];
                    const phase = this.time * this.JUGGLE_SPEED * 1.4 + orb.phase;
                    orb.localPos.set(
                        Math.sin(phase) * 0.7,
                        Math.sin(phase * 2) * 0.38 + 0.2,
                        Math.cos(phase) * 0.4
                    );
                    orb.mesh.position.copy(orb.localPos);
                }
                this.giftTimer += dt;
                const flyT = Math.min(1, this.giftTimer / 1.4);
                if (this.giftOrb) {
                    const arcY = Math.sin(flyT * Math.PI) * 2.5;
                    const pos = new THREE.Vector3().lerpVectors(this.giftStart, this.giftTarget, flyT);
                    pos.y += arcY;
                    this.giftOrb.mesh.position.copy(this.orbsGroup!.worldToLocal(pos));
                    this.giftOrb.mesh.scale.setScalar(1 + flyT * 0.3);
                }
                if (flyT >= 1) {
                    this.giftState = 'waving';
                    this.giftTimer = 0;
                    this.hasGifted = true;
                    if (this.giftOrb) {
                        this.giftOrb.mesh.visible = false;
                        this.giftOrb.light.intensity = 0;
                    }
                    result = {
                        type: 'otter_gift',
                        position: playerPos.clone(),
                        bonus: this.GIFT_CORES
                    };
                }
                break;
            }
            case 'waving': {
                this.updateJugglePositions(0.6);
                this.giftTimer += dt;
                if (this.leftPaw && this.rightPaw) {
                    const wave = Math.sin(this.giftTimer * 10) * 0.4;
                    this.leftPaw.rotation.z = wave - 0.3;
                    this.rightPaw.rotation.z = -wave + 0.3;
                    this.leftPaw.position.y = 0.35 + Math.sin(this.giftTimer * 10) * 0.12;
                    this.rightPaw.position.y = 0.35 + Math.sin(this.giftTimer * 10 + 0.5) * 0.12;
                }
                if (this.headGroup) {
                    this.headGroup.rotation.z = Math.sin(this.giftTimer * 6) * 0.1;
                }
                if (this.giftTimer >= 1.8) {
                    this.giftState = 'done';
                    if (this.giftOrb) {
                        this.giftOrb.isGift = false;
                        this.giftOrb.mesh.visible = true;
                        this.giftOrb.mesh.scale.setScalar(1);
                        this.giftOrb.light.intensity = 0.6;
                    }
                }
                break;
            }
            case 'done': {
                this.updateJugglePositions(1);
                this.aimArmsAtOrbs();
                if (dist > this.INTERACTION_DISTANCE + 4) {
                    this.hasGifted = false;
                    this.giftState = 'juggling';
                    this.calmTimer = 0;
                }
                break;
            }
        }

        return result;
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.group);
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    }

    getDistanceToPlayer(playerPos: THREE.Vector3): number {
        return this.position.distanceTo(playerPos);
    }
}
