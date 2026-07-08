import * as THREE from 'three';
import type { InteractionResult } from './types';

type PenguinState = 'waddling' | 'excited' | 'sliding' | 'recovering';

export class SpacePenguin {
    group: THREE.Group;
    position: THREE.Vector3;
    baseY: number;

    time: number = 0;
    state: PenguinState = 'waddling';
    stateTimer: number = 0;
    hasSlid: boolean = false;
    iceTrailTimer: number = 0;
    slideOffset: number = 0;

    private animGroup: THREE.Group | null = null;
    private bodyGroup: THREE.Group | null = null;
    private headGroup: THREE.Group | null = null;
    private leftFlipper: THREE.Group | null = null;
    private rightFlipper: THREE.Group | null = null;
    private leftLeg: THREE.Group | null = null;
    private rightLeg: THREE.Group | null = null;
    private leftEye: THREE.Mesh | null = null;
    private rightEye: THREE.Mesh | null = null;
    private leftBrow: THREE.Mesh | null = null;
    private rightBrow: THREE.Mesh | null = null;

    readonly INTERACTION_DISTANCE = 9;
    readonly SLIDE_DISTANCE = 2.4;
    readonly SLIDE_DURATION = 1.1;
    readonly SLIDE_ASSIST_SECONDS = 3;
    readonly GIFT_CORES = 1;

    constructor(scene: THREE.Scene, x: number, y: number) {
        this.position = new THREE.Vector3(x, y, 0);
        this.baseY = y;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'astroPenguin';

        this.createMesh();
        scene.add(this.group);
    }

    private createMesh(): void {
        this.animGroup = new THREE.Group();
        this.bodyGroup = new THREE.Group();

        const blackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.85 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.9 });
        const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff7722, roughness: 0.55 });

        // Torso — black back, white belly
        const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 14), blackMat);
        torso.scale.set(0.95, 1.05, 0.85);
        this.bodyGroup.add(torso);

        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12), whiteMat);
        belly.position.set(0, -0.05, 0.14);
        belly.scale.set(0.85, 0.9, 0.45);
        this.bodyGroup.add(belly);

        // Head
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 0.38, 0.12);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 14), blackMat);
        this.headGroup.add(head);

        const facePatch = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), whiteMat);
        facePatch.position.set(0, -0.04, 0.12);
        facePatch.scale.set(0.9, 0.75, 0.5);
        this.headGroup.add(facePatch);

        // Dot eyes + happy brows (hidden until excited)
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.2 });
        const browMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.3 });

        this.leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
        this.leftEye.position.set(-0.1, 0.02, 0.24);
        this.headGroup.add(this.leftEye);

        this.rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
        this.rightEye.position.set(0.1, 0.02, 0.24);
        this.headGroup.add(this.rightEye);

        this.leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.02), browMat);
        this.leftBrow.position.set(-0.1, 0.1, 0.23);
        this.leftBrow.rotation.z = 0.55;
        this.leftBrow.visible = false;
        this.headGroup.add(this.leftBrow);

        this.rightBrow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.02), browMat);
        this.rightBrow.position.set(0.1, 0.1, 0.23);
        this.rightBrow.rotation.z = -0.55;
        this.rightBrow.visible = false;
        this.headGroup.add(this.rightBrow);

        // Orange beak
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 8), orangeMat);
        beak.position.set(0, -0.06, 0.3);
        beak.rotation.x = Math.PI / 2;
        this.headGroup.add(beak);

        // Tiny fishbowl helmet
        const helmet = new THREE.Mesh(
            new THREE.SphereGeometry(0.38, 14, 14),
            new THREE.MeshPhysicalMaterial({
                color: 0xaaddff,
                transmission: 0.88,
                roughness: 0.05,
                transparent: true,
                opacity: 0.3
            })
        );
        helmet.position.y = 0.06;
        this.headGroup.add(helmet);

        // Cozy space scarf
        const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 16), orangeMat);
        scarf.position.set(0, 0.12, 0.02);
        scarf.rotation.x = Math.PI / 2;
        this.headGroup.add(scarf);

        this.bodyGroup.add(this.headGroup);

        // Flippers
        this.leftFlipper = new THREE.Group();
        this.leftFlipper.position.set(-0.42, 0.05, 0.05);
        const leftFlipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), blackMat);
        leftFlipMesh.scale.set(0.5, 1.2, 0.7);
        this.leftFlipper.add(leftFlipMesh);
        this.bodyGroup.add(this.leftFlipper);

        this.rightFlipper = new THREE.Group();
        this.rightFlipper.position.set(0.42, 0.05, 0.05);
        const rightFlipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), blackMat);
        rightFlipMesh.scale.set(0.5, 1.2, 0.7);
        this.rightFlipper.add(rightFlipMesh);
        this.bodyGroup.add(this.rightFlipper);

        // Feet
        this.leftLeg = new THREE.Group();
        this.leftLeg.position.set(-0.16, -0.38, 0.1);
        const leftFoot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), orangeMat);
        leftFoot.scale.set(1.2, 0.5, 1.4);
        this.leftLeg.add(leftFoot);
        this.bodyGroup.add(this.leftLeg);

        this.rightLeg = new THREE.Group();
        this.rightLeg.position.set(0.16, -0.38, 0.1);
        const rightFoot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), orangeMat);
        rightFoot.scale.set(1.2, 0.5, 1.4);
        this.rightLeg.add(rightFoot);
        this.bodyGroup.add(this.rightLeg);

        this.animGroup.add(this.bodyGroup);

        const glow = new THREE.PointLight(0xaaddff, 0.3, 4);
        glow.position.set(0, 0.3, 0.4);
        this.animGroup.add(glow);

        this.group.add(this.animGroup);
        this.group.userData.penguin = this;
    }

    private setHappyFace(happy: boolean): void {
        const eyeScale = happy ? 1.35 : 1.0;
        if (this.leftEye) this.leftEye.scale.setScalar(eyeScale);
        if (this.rightEye) this.rightEye.scale.setScalar(eyeScale);
        if (this.leftBrow) this.leftBrow.visible = happy;
        if (this.rightBrow) this.rightBrow.visible = happy;
    }

    private animateWaddle(): void {
        const waddleT = this.time * 5.5;
        const legSwing = Math.sin(waddleT) * 0.28;
        if (this.leftLeg) this.leftLeg.rotation.x = legSwing;
        if (this.rightLeg) this.rightLeg.rotation.x = -legSwing;
        if (this.bodyGroup) {
            this.bodyGroup.position.y = Math.abs(Math.sin(waddleT)) * 0.05;
            this.bodyGroup.rotation.z = Math.sin(waddleT) * 0.06;
        }
        if (this.headGroup) {
            this.headGroup.rotation.z = -Math.sin(waddleT) * 0.08;
            this.headGroup.position.y = 0.38 + Math.sin(waddleT * 2) * 0.02;
        }
        if (this.leftFlipper) this.leftFlipper.rotation.z = 0.2 + Math.sin(waddleT) * 0.1;
        if (this.rightFlipper) this.rightFlipper.rotation.z = -0.2 - Math.sin(waddleT) * 0.1;
    }

    update(dt: number, playerPos: THREE.Vector3, disturbed: boolean = false): InteractionResult | null {
        this.time += dt;
        this.stateTimer += dt;
        let result: InteractionResult | null = null;

        const dist = this.position.distanceTo(playerPos);
        const floatY = Math.sin(this.time * 1.2) * 0.12;
        this.group.position.y = this.baseY + floatY;

        switch (this.state) {
            case 'waddling': {
                if (this.animGroup) {
                    this.animGroup.rotation.z = THREE.MathUtils.lerp(this.animGroup.rotation.z, 0, dt * 6);
                    this.animGroup.position.x = THREE.MathUtils.lerp(this.animGroup.position.x, 0, dt * 4);
                }
                this.slideOffset = 0;
                this.setHappyFace(false);
                this.animateWaddle();

                if (!this.hasSlid && !disturbed && dist < this.INTERACTION_DISTANCE) {
                    this.state = 'excited';
                    this.stateTimer = 0;
                    this.setHappyFace(true);
                }
                if (dist > this.INTERACTION_DISTANCE + 5) {
                    this.hasSlid = false;
                }
                break;
            }
            case 'excited': {
                this.setHappyFace(true);
                if (this.leftFlipper) this.leftFlipper.rotation.z = Math.sin(this.time * 18) * 0.5;
                if (this.rightFlipper) this.rightFlipper.rotation.z = -Math.sin(this.time * 18 + 0.5) * 0.5;
                if (this.headGroup) this.headGroup.rotation.y = Math.sin(this.time * 12) * 0.15;

                if (disturbed || dist > this.INTERACTION_DISTANCE + 2) {
                    this.state = 'waddling';
                    this.stateTimer = 0;
                    break;
                }
                if (this.stateTimer >= 0.35) {
                    this.state = 'sliding';
                    this.stateTimer = 0;
                    this.slideOffset = 0;
                    this.iceTrailTimer = 0;
                }
                break;
            }
            case 'sliding': {
                const slideT = Math.min(1, this.stateTimer / this.SLIDE_DURATION);
                if (this.animGroup) {
                    this.animGroup.rotation.z = THREE.MathUtils.lerp(0, 1.22, slideT);
                    this.slideOffset = slideT * this.SLIDE_DISTANCE;
                    this.animGroup.position.x = this.slideOffset;
                }
                if (this.leftFlipper) this.leftFlipper.rotation.z = 0.6 + Math.sin(this.time * 20) * 0.3;
                if (this.rightFlipper) this.rightFlipper.rotation.z = -0.6 - Math.sin(this.time * 20) * 0.3;
                this.setHappyFace(true);

                this.iceTrailTimer += dt;
                if (this.iceTrailTimer >= 0.12) {
                    this.iceTrailTimer = 0;
                    const bellyPos = this.position.clone();
                    bellyPos.x += this.slideOffset;
                    bellyPos.y -= 0.2;
                    result = { type: 'penguin_ice_trail', position: bellyPos };
                }

                if (slideT >= 1) {
                    this.state = 'recovering';
                    this.stateTimer = 0;
                    this.hasSlid = true;
                    result = {
                        type: 'penguin_slide',
                        position: playerPos.clone(),
                        bonus: this.GIFT_CORES,
                        slideAssistDuration: this.SLIDE_ASSIST_SECONDS
                    };
                }
                break;
            }
            case 'recovering': {
                const recoverT = Math.min(1, this.stateTimer / 0.8);
                if (this.animGroup) {
                    this.animGroup.rotation.z = THREE.MathUtils.lerp(1.22, 0, recoverT);
                    this.animGroup.position.x = THREE.MathUtils.lerp(this.slideOffset, 0, recoverT);
                }
                this.animateWaddle();
                this.setHappyFace(recoverT < 0.5);

                if (recoverT >= 1) {
                    this.state = 'waddling';
                    this.stateTimer = 0;
                    this.position.x += this.SLIDE_DISTANCE * 0.35;
                    this.group.position.x = this.position.x;
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
