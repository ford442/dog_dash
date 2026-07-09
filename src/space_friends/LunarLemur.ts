import * as THREE from 'three';
import type { InteractionResult } from './types';

export type LemurPerchType = 'geode' | 'gravityAnchor' | 'iceNeedle' | 'industrial';

type LemurState = 'idle' | 'watching' | 'greeting' | 'panicking' | 'leaping';

const TAIL_SEGMENTS = 4;

export class LunarLemur {
    group: THREE.Group;
    readonly position: THREE.Vector3;
    readonly perchPos: THREE.Vector3;
    readonly perchType: LemurPerchType;

    private time = 0;
    private stateTimer = 0;
    private state: LemurState = 'idle';
    private phaseOffset: number;
    private hasGifted = false;
    private leapVelocity = new THREE.Vector3();
    private leapTimer = 0;
    gone = false;

    private bodyGroup: THREE.Group | null = null;
    private headGroup: THREE.Group | null = null;
    private tailSegments: THREE.Group[] = [];
    private leftEye: THREE.Mesh | null = null;
    private rightEye: THREE.Mesh | null = null;

    /** Only track / lookAt inside this radius (perf). */
    readonly ACTIVATION_RADIUS = 28;
    readonly GREET_DISTANCE = 11;
    readonly PANIC_DISTANCE = 7;
    readonly CALM_SPEED_MAX = 14;

    constructor(
        scene: THREE.Scene,
        perchPos: THREE.Vector3,
        perchType: LemurPerchType,
        perchOffsetY = 2.2
    ) {
        this.perchPos = perchPos.clone();
        this.perchType = perchType;
        this.phaseOffset = Math.random() * Math.PI * 2;

        const side = Math.random() < 0.5 ? -1 : 1;
        const perchRadius = perchType === 'geode' ? 1.6 : perchType === 'gravityAnchor' ? 2.4 : 1.2;
        this.position = new THREE.Vector3(
            perchPos.x + side * perchRadius * 0.55,
            perchPos.y + perchOffsetY,
            perchPos.z + (Math.random() - 0.5) * 1.2
        );

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'lunarLemur';
        this.group.userData.lunarLemur = this;

        this.createMesh();
        scene.add(this.group);
    }

    private createMesh(): void {
        const root = new THREE.Group();
        this.bodyGroup = root;

        const furMat = new THREE.MeshStandardMaterial({
            color: 0x6b5b7a,
            roughness: 0.88,
            metalness: 0.02
        });
        const bellyMat = new THREE.MeshStandardMaterial({
            color: 0xc8b8d8,
            roughness: 0.9
        });
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x9988aa,
            roughness: 0.85
        });
        const ringDarkMat = new THREE.MeshStandardMaterial({
            color: 0x554466,
            roughness: 0.88
        });

        // Crouched body — clinging to perch
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), furMat);
        body.scale.set(1.05, 0.85, 0.9);
        body.position.y = 0.05;
        root.add(body);

        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), bellyMat);
        belly.position.set(0, -0.02, 0.14);
        belly.scale.set(0.85, 0.65, 0.45);
        root.add(belly);

        // Head
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 0.38, 0.18);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), furMat);
        this.headGroup.add(head);

        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfff8ff, roughness: 0.25 });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x221133, roughness: 0.15 });
        const eyeGeo = new THREE.SphereGeometry(0.11, 8, 8);
        const pupilGeo = new THREE.SphereGeometry(0.055, 6, 6);

        for (const side of [-1, 1]) {
            const eyeGroup = new THREE.Group();
            eyeGroup.position.set(0.13 * side, 0.06, 0.22);
            const white = new THREE.Mesh(eyeGeo, eyeWhiteMat);
            eyeGroup.add(white);
            const pupil = new THREE.Mesh(pupilGeo, pupilMat);
            pupil.position.z = 0.06;
            eyeGroup.add(pupil);
            if (side < 0) this.leftEye = white;
            else this.rightEye = white;
            this.headGroup.add(eyeGroup);
        }

        // Tiny rounded ears
        const earGeo = new THREE.SphereGeometry(0.08, 6, 6);
        for (const side of [-1, 1]) {
            const ear = new THREE.Mesh(earGeo, furMat);
            ear.position.set(0.2 * side, 0.2, 0.02);
            ear.scale.set(0.7, 1.1, 0.45);
            this.headGroup.add(ear);
        }

        root.add(this.headGroup);

        // Ring tail — segmented cylinders
        const tailRoot = new THREE.Group();
        tailRoot.position.set(0, 0.1, -0.35);
        root.add(tailRoot);

        let parent: THREE.Object3D = tailRoot;
        for (let i = 0; i < TAIL_SEGMENTS; i++) {
            const segGroup = new THREE.Group();
            const radius = 0.07 - i * 0.012;
            const mat = i % 2 === 0 ? ringMat : ringDarkMat;
            const seg = new THREE.Mesh(
                new THREE.CylinderGeometry(radius * 0.85, radius, 0.28, 6),
                mat
            );
            seg.rotation.x = Math.PI / 2;
            seg.position.z = -0.14;
            segGroup.add(seg);
            segGroup.position.z = i === 0 ? 0 : -0.22;
            parent.add(segGroup);
            this.tailSegments.push(segGroup);
            parent = segGroup;
        }

        root.scale.setScalar(0.72);
        this.group.add(root);
    }

    triggerPanic(): void {
        if (this.state === 'leaping') return;
        this.state = 'panicking';
        this.stateTimer = 0;
    }

    update(
        dt: number,
        playerPos: THREE.Vector3,
        playerSpeed: number,
        disturbed: boolean
    ): InteractionResult | null {
        this.time += dt;
        this.stateTimer += dt;

        if (this.state === 'leaping') {
            return this._updateLeap(dt);
        }

        const dist = this.position.distanceTo(playerPos);
        const inRange = dist < this.ACTIVATION_RADIUS;

        if (disturbed && inRange) {
            this.triggerPanic();
        } else if (this.state !== 'panicking' && this.state !== 'greeting') {
            if (dist < this.GREET_DISTANCE && playerSpeed < this.CALM_SPEED_MAX && !this.hasGifted) {
                this.state = 'greeting';
                this.stateTimer = 0;
            } else if (inRange) {
                this.state = 'watching';
            } else {
                this.state = 'idle';
            }
        }

        if (this.state === 'panicking') {
            if (this.stateTimer > 0.55) {
                this._beginLeap(playerPos);
                return { type: 'lemur_panic', position: this.position.clone() };
            }
        }

        if (this.state === 'greeting' && this.stateTimer > 1.4 && !this.hasGifted) {
            this.hasGifted = true;
            this.state = 'watching';
            this.stateTimer = 0;
            return {
                type: 'lemur_heart_gift',
                position: this.position.clone().add(new THREE.Vector3(0, 0.6, 0.4))
            };
        }

        if (this.state === 'greeting' && this.stateTimer > 3.5) {
            this.state = inRange ? 'watching' : 'idle';
            this.stateTimer = 0;
        }

        this._animate(dt, playerPos, inRange);
        return null;
    }

    private _beginLeap(playerPos: THREE.Vector3): void {
        this.state = 'leaping';
        this.leapTimer = 1.6;
        const away = this.position.clone().sub(playerPos);
        if (away.lengthSq() < 0.01) away.set(1, 0.5, 0);
        away.normalize();
        this.leapVelocity.set(away.x * 9, away.y * 6 + 4, away.z * 5);
    }

    private _updateLeap(dt: number): InteractionResult | null {
        this.leapTimer -= dt;
        this.leapVelocity.y -= 12 * dt;
        this.position.addScaledVector(this.leapVelocity, dt);
        this.group.position.copy(this.position);
        this.group.rotation.z += dt * 8;

        if (this.leapTimer <= 0) {
            this.group.visible = false;
            this.gone = true;
        }
        return null;
    }

    private _animate(dt: number, playerPos: THREE.Vector3, inRange: boolean): void {
        if (!this.bodyGroup || !this.headGroup) return;

        const tailCurl = Math.sin(this.time * 0.9 + this.phaseOffset) * 0.35 + 0.2;
        for (let i = 0; i < this.tailSegments.length; i++) {
            const seg = this.tailSegments[i];
            const wave = Math.sin(this.time * 2.2 + i * 0.7 + this.phaseOffset) * 0.12;
            seg.rotation.y = tailCurl * (i + 1) * 0.22 + wave;
            seg.rotation.x = Math.sin(this.time * 1.6 + i) * 0.08;
        }

        switch (this.state) {
            case 'idle':
                this.bodyGroup.position.y = Math.sin(this.time * 1.4 + this.phaseOffset) * 0.04;
                this.bodyGroup.rotation.x = 0.25;
                this.headGroup.rotation.set(0, 0, 0);
                if (this.leftEye) this.leftEye.scale.setScalar(1);
                if (this.rightEye) this.rightEye.scale.setScalar(1);
                break;

            case 'watching':
                this.bodyGroup.position.y = Math.sin(this.time * 1.2 + this.phaseOffset) * 0.05;
                this.bodyGroup.rotation.x = 0.2;
                if (inRange) {
                    const lookTarget = new THREE.Vector3(playerPos.x, playerPos.y, this.position.z + 0.5);
                    this.headGroup.lookAt(lookTarget);
                }
                if (this.leftEye) this.leftEye.scale.setScalar(1.08);
                if (this.rightEye) this.rightEye.scale.setScalar(1.08);
                break;

            case 'greeting':
                this.bodyGroup.rotation.x = THREE.MathUtils.lerp(this.bodyGroup.rotation.x, -0.15, dt * 4);
                this.bodyGroup.position.y = Math.sin(this.time * 3.5) * 0.08;
                if (inRange) {
                    this.headGroup.lookAt(playerPos.x, playerPos.y, this.position.z + 0.5);
                }
                // Wave tail
                for (let i = 0; i < this.tailSegments.length; i++) {
                    this.tailSegments[i].rotation.y += Math.sin(this.time * 6 + i) * 0.08;
                }
                break;

            case 'panicking':
                this.bodyGroup.rotation.z = Math.sin(this.time * 22) * 0.12;
                this.bodyGroup.position.y = Math.abs(Math.sin(this.time * 18)) * 0.12;
                if (this.leftEye) this.leftEye.scale.setScalar(1.2);
                if (this.rightEye) this.rightEye.scale.setScalar(1.2);
                break;

            default:
                break;
        }
    }

    destroy(scene: THREE.Scene): void {
        scene.remove(this.group);
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                const mat = child.material;
                if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                else mat?.dispose();
            }
        });
    }
}
