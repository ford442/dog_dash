import * as THREE from 'three';
import type { InteractionResult } from './types';

type SealState = 'idle' | 'clapping';

export class SpaceSealPup {
    group: THREE.Group;
    position: THREE.Vector3;
    baseY: number;

    time: number = 0;
    state: SealState = 'idle';
    clapPhase: number = 0;
    hasCheered: boolean = false;
    healCooldown: number = 0;
    cheerCooldown: number = 0;

    private animGroup: THREE.Group | null = null;
    private bodyGroup: THREE.Group | null = null;
    private headGroup: THREE.Group | null = null;
    private leftFlipper: THREE.Group | null = null;
    private rightFlipper: THREE.Group | null = null;
    private tailFin: THREE.Group | null = null;
    private leftEye: THREE.Mesh | null = null;
    private rightEye: THREE.Mesh | null = null;
    private leftEyeShine: THREE.Mesh | null = null;
    private rightEyeShine: THREE.Mesh | null = null;
    private tongue: THREE.Mesh | null = null;
    private whiskers: THREE.Group | null = null;

    readonly INTERACTION_DISTANCE = 8.5;
    readonly HEAL_AMOUNT = 1;
    readonly HEAL_COOLDOWN = 3.5;
    readonly CLAP_SPEED = 4.2;
    readonly FLOAT_AMPLITUDE = 0.35;
    readonly FLOAT_SPEED = 1.3;

    constructor(scene: THREE.Scene, x: number, y: number) {
        this.position = new THREE.Vector3(x, y, 0);
        this.baseY = y;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'stellarSealPup';

        this.createMesh();
        scene.add(this.group);
    }

    private createMesh(): void {
        this.animGroup = new THREE.Group();
        this.bodyGroup = new THREE.Group();

        const furMat = new THREE.MeshStandardMaterial({
            color: 0xd4c4b0,
            roughness: 0.82,
            metalness: 0.05
        });
        const bellyMat = new THREE.MeshStandardMaterial({
            color: 0xf0e8dc,
            roughness: 0.88
        });

        // Rounded sausage body
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 8, 12), furMat);
        body.rotation.z = Math.PI / 2;
        body.scale.set(1.1, 1, 0.95);
        this.bodyGroup.add(body);

        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), bellyMat);
        belly.position.set(0, -0.06, 0.14);
        belly.scale.set(0.95, 0.75, 0.45);
        this.bodyGroup.add(belly);

        // Big round head
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0.42, 0.12, 0);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 14), furMat);
        this.headGroup.add(head);

        const snout = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), furMat);
        snout.position.set(0.14, -0.04, 0);
        snout.scale.set(1.1, 0.75, 0.85);
        this.headGroup.add(snout);

        // Shiny eyes
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x223355, roughness: 0.15, metalness: 0.2 });
        const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        this.leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), eyeMat);
        this.leftEye.position.set(0.08, 0.08, 0.2);
        this.headGroup.add(this.leftEye);

        this.rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), eyeMat);
        this.rightEye.position.set(0.08, 0.08, -0.2);
        this.headGroup.add(this.rightEye);

        this.leftEyeShine = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), shineMat);
        this.leftEyeShine.position.set(0.1, 0.11, 0.24);
        this.headGroup.add(this.leftEyeShine);

        this.rightEyeShine = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), shineMat);
        this.rightEyeShine.position.set(0.1, 0.11, -0.24);
        this.headGroup.add(this.rightEyeShine);

        // Whiskers
        this.whiskers = new THREE.Group();
        const whiskerMat = new THREE.MeshStandardMaterial({ color: 0x998877, roughness: 0.9 });
        for (const side of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
                const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.22, 4), whiskerMat);
                whisker.position.set(0.2, -0.02 + i * 0.05, side * 0.12);
                whisker.rotation.z = side * (0.4 + i * 0.12);
                whisker.rotation.y = side * 0.15;
                this.whiskers.add(whisker);
            }
        }
        this.headGroup.add(this.whiskers);

        // Happy pink tongue (shown while clapping)
        this.tongue = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xff8899, roughness: 0.6 })
        );
        this.tongue.position.set(0.22, -0.1, 0);
        this.tongue.scale.set(1.2, 0.6, 0.8);
        this.tongue.visible = false;
        this.headGroup.add(this.tongue);

        // Tiny nose
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.5 })
        );
        nose.position.set(0.24, -0.02, 0);
        this.headGroup.add(nose);

        this.bodyGroup.add(this.headGroup);

        // Flippers (hinged at shoulders)
        this.leftFlipper = new THREE.Group();
        this.leftFlipper.position.set(0.05, -0.02, 0.34);
        const leftFlipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), furMat);
        leftFlipMesh.scale.set(0.55, 1.15, 0.75);
        leftFlipMesh.position.set(0, -0.12, 0);
        this.leftFlipper.add(leftFlipMesh);
        this.bodyGroup.add(this.leftFlipper);

        this.rightFlipper = new THREE.Group();
        this.rightFlipper.position.set(0.05, -0.02, -0.34);
        const rightFlipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), furMat);
        rightFlipMesh.scale.set(0.55, 1.15, 0.75);
        rightFlipMesh.position.set(0, -0.12, 0);
        this.rightFlipper.add(rightFlipMesh);
        this.bodyGroup.add(this.rightFlipper);

        // Tail fin
        this.tailFin = new THREE.Group();
        this.tailFin.position.set(-0.48, -0.02, 0);
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), furMat);
        tail.scale.set(0.5, 1.1, 0.35);
        this.tailFin.add(tail);
        this.bodyGroup.add(this.tailFin);

        // Space bubble helmet
        const bubble = new THREE.Mesh(
            new THREE.SphereGeometry(0.78, 16, 16),
            new THREE.MeshPhysicalMaterial({
                color: 0xaaddff,
                transmission: 0.88,
                roughness: 0.05,
                transparent: true,
                opacity: 0.28,
                thickness: 0.08
            })
        );
        bubble.position.set(0.15, 0.08, 0);
        this.bodyGroup.add(bubble);

        const bubbleRim = new THREE.Mesh(
            new THREE.TorusGeometry(0.78, 0.03, 6, 20),
            new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.5, roughness: 0.3 })
        );
        bubbleRim.position.set(0.15, 0.08, 0);
        bubbleRim.rotation.y = Math.PI / 2;
        this.bodyGroup.add(bubbleRim);

        this.animGroup.add(this.bodyGroup);

        const glow = new THREE.PointLight(0xaaddff, 0.28, 4);
        glow.position.set(0.2, 0.2, 0);
        this.animGroup.add(glow);

        this.group.add(this.animGroup);
        this.group.userData.sealPup = this;
    }

    private setClapFace(clapping: boolean): void {
        if (this.tongue) this.tongue.visible = clapping;
        const eyeScaleY = clapping ? 0.25 : 1.0;
        const eyeScaleX = clapping ? 1.3 : 1.0;
        if (this.leftEye) this.leftEye.scale.set(eyeScaleX, eyeScaleY, 1);
        if (this.rightEye) this.rightEye.scale.set(eyeScaleX, eyeScaleY, 1);
        if (this.leftEyeShine) this.leftEyeShine.visible = !clapping;
        if (this.rightEyeShine) this.rightEyeShine.visible = !clapping;
    }

    private animateIdle(): void {
        const bob = Math.sin(this.time * this.FLOAT_SPEED) * this.FLOAT_AMPLITUDE;
        this.group.position.y = this.baseY + bob;

        if (this.headGroup) {
            this.headGroup.rotation.y = Math.sin(this.time * 0.9) * 0.12;
            this.headGroup.rotation.z = Math.sin(this.time * 0.7) * 0.06;
        }
        if (this.leftFlipper) this.leftFlipper.rotation.x = 0.15 + Math.sin(this.time * 1.5) * 0.08;
        if (this.rightFlipper) this.rightFlipper.rotation.x = 0.15 - Math.sin(this.time * 1.5) * 0.08;
        if (this.tailFin) this.tailFin.rotation.y = Math.sin(this.time * 2) * 0.15;
        if (this.bodyGroup) {
            this.bodyGroup.scale.set(1, 1, 1);
            this.bodyGroup.position.y = 0;
        }
        this.setClapFace(false);
    }

    private animateClap(): void {
        const bob = Math.sin(this.time * this.FLOAT_SPEED * 1.4) * this.FLOAT_AMPLITUDE * 0.6;
        this.group.position.y = this.baseY + bob;

        const leftSwing = Math.max(0, Math.sin(this.clapPhase - 0.15));
        const rightSwing = Math.max(0, Math.sin(this.clapPhase));
        if (this.leftFlipper) {
            this.leftFlipper.rotation.x = 0.15 + leftSwing * 1.35;
            this.leftFlipper.rotation.z = leftSwing * 0.2;
        }
        if (this.rightFlipper) {
            this.rightFlipper.rotation.x = 0.15 + rightSwing * 1.35;
            this.rightFlipper.rotation.z = -rightSwing * 0.2;
        }

        // Body squash on flipper contact
        const squash = 1 - Math.pow(Math.sin(this.clapPhase * 2), 2) * 0.12;
        const stretch = 1 + Math.pow(Math.sin(this.clapPhase * 2), 2) * 0.06;
        if (this.bodyGroup) {
            this.bodyGroup.scale.set(stretch, squash, squash);
            this.bodyGroup.position.y = -Math.pow(Math.sin(this.clapPhase * 2), 2) * 0.04;
        }

        if (this.headGroup) {
            this.headGroup.rotation.y = Math.sin(this.time * 3) * 0.08;
            this.headGroup.rotation.x = Math.sin(this.clapPhase * 2) * 0.05;
        }
        if (this.tailFin) {
            this.tailFin.rotation.y = Math.sin(this.clapPhase * 2) * 0.35;
        }
        this.setClapFace(true);
    }

    update(dt: number, playerPos: THREE.Vector3, disturbed: boolean = false): InteractionResult | null {
        this.time += dt;
        this.healCooldown = Math.max(0, this.healCooldown - dt);
        this.cheerCooldown = Math.max(0, this.cheerCooldown - dt);

        const dist = this.position.distanceTo(playerPos);
        let result: InteractionResult | null = null;

        if (!disturbed && dist < this.INTERACTION_DISTANCE) {
            if (this.state !== 'clapping') {
                this.state = 'clapping';
                this.clapPhase = 0;
            }
            this.clapPhase += dt * this.CLAP_SPEED;
            this.animateClap();

            // Cheer pulse on each clap contact: glow + optional tiny heal
            if (this.cheerCooldown <= 0 && Math.sin(this.clapPhase * 2) > 0.92) {
                this.cheerCooldown = 0.38;
                const cheerPos = this.position.clone();
                cheerPos.x += 0.55;
                cheerPos.y += 0.1;
                const canHeal = this.healCooldown <= 0;
                result = {
                    type: 'seal_clap',
                    position: cheerPos,
                    healthRestore: canHeal ? this.HEAL_AMOUNT : undefined
                };
                if (canHeal) {
                    this.healCooldown = this.HEAL_COOLDOWN;
                }
                this.hasCheered = true;
            }
        } else {
            this.state = 'idle';
            this.animateIdle();
            if (dist > this.INTERACTION_DISTANCE + 4) {
                this.hasCheered = false;
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
