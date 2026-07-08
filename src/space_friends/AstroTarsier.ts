import * as THREE from 'three';
import type { InteractionResult } from './types';

type TarsierState = 'idle' | 'alarmed' | 'panicking' | 'cheering';

export class AstroTarsier {
    group: THREE.Group;
    position: THREE.Vector3;   // world position (updated each frame)
    anchorPos: THREE.Vector3;  // gravity anchor this tarsier orbits

    // Animation state
    time: number = 0;
    state: TarsierState = 'idle';
    private stateTimer: number = 0;

    // Orbital parameters (tarsier clings near its anchor)
    private orbitAngle: number;
    private orbitRadius: number;
    private orbitZ: number;

    // Per-tarsier idle variation
    private phaseOffset: number;

    // Parts for animation
    private headGroup: THREE.Group | null = null;
    private leftEye: THREE.Mesh | null = null;
    private rightEye: THREE.Mesh | null = null;
    private leftEar: THREE.Mesh | null = null;
    private rightEar: THREE.Mesh | null = null;
    private body: THREE.Mesh | null = null;

    // Constants
    readonly ALARM_DISTANCE = 14;
    readonly PANIC_DISTANCE = 8;
    readonly CHEER_DURATION = 1.8;
    readonly PANIC_DURATION = 2.0;
    readonly ALARMED_DURATION = 1.2;

    constructor(scene: THREE.Scene, anchorPos: THREE.Vector3, index: number) {
        this.anchorPos = anchorPos.clone();

        // Spread tarsiers around the anchor at varying angles/radii
        this.orbitAngle = (index / 5) * Math.PI * 2 + Math.random() * 0.4;
        this.orbitRadius = 6 + Math.random() * 4;
        this.orbitZ = (Math.random() - 0.5) * 8 - 10; // behind the anchor in Z
        this.phaseOffset = Math.random() * Math.PI * 2;

        this.position = new THREE.Vector3(
            anchorPos.x + Math.cos(this.orbitAngle) * this.orbitRadius,
            anchorPos.y + Math.sin(this.orbitAngle) * this.orbitRadius * 0.6,
            this.orbitZ
        );

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.userData.speciesId = 'astroTarsier';

        this.createMesh();
        scene.add(this.group);
    }

    private createMesh(): void {
        const tarsierGroup = new THREE.Group();

        // --- Body ---
        const bodyGeo = new THREE.SphereGeometry(0.38, 12, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xc8a87a,   // warm sandy-tan
            roughness: 0.85,
            metalness: 0.0
        });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.scale.set(1, 1.1, 0.9);
        tarsierGroup.add(this.body);

        // --- Head group (allows independent head rotation) ---
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 0.45, 0.1);
        tarsierGroup.add(this.headGroup);

        // Head sphere
        const headGeo = new THREE.SphereGeometry(0.32, 12, 12);
        const headMesh = new THREE.Mesh(headGeo, bodyMat.clone());
        this.headGroup.add(headMesh);

        // --- Big eyes (tarsier trademark) ---
        const eyeGeo = new THREE.SphereGeometry(0.13, 10, 10);
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const pupilGeo = new THREE.SphereGeometry(0.07, 8, 8);
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });

        // Left eye
        const leftEyeGroup = new THREE.Group();
        leftEyeGroup.position.set(-0.14, 0.05, 0.26);
        const leftWhite = new THREE.Mesh(eyeGeo, eyeWhiteMat);
        this.leftEye = leftWhite;
        leftEyeGroup.add(leftWhite);
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(0, 0, 0.07);
        leftEyeGroup.add(leftPupil);
        this.headGroup.add(leftEyeGroup);

        // Right eye
        const rightEyeGroup = new THREE.Group();
        rightEyeGroup.position.set(0.14, 0.05, 0.26);
        const rightWhite = new THREE.Mesh(eyeGeo, eyeWhiteMat);
        this.rightEye = rightWhite;
        rightEyeGroup.add(rightWhite);
        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0, 0, 0.07);
        rightEyeGroup.add(rightPupil);
        this.headGroup.add(rightEyeGroup);

        // --- Large rounded ears ---
        const earGeo = new THREE.SphereGeometry(0.18, 8, 8);
        const earMat = new THREE.MeshStandardMaterial({ color: 0xb8916a, roughness: 0.9 });

        this.leftEar = new THREE.Mesh(earGeo, earMat);
        this.leftEar.scale.set(0.7, 1.2, 0.4);
        this.leftEar.position.set(-0.28, 0.28, 0);
        this.headGroup.add(this.leftEar);

        this.rightEar = new THREE.Mesh(earGeo, earMat);
        this.rightEar.scale.set(0.7, 1.2, 0.4);
        this.rightEar.position.set(0.28, 0.28, 0);
        this.headGroup.add(this.rightEar);

        // --- Tiny tail ---
        const tailGeo = new THREE.CylinderGeometry(0.04, 0.02, 0.55, 6);
        const tailMat = new THREE.MeshStandardMaterial({ color: 0xb8916a, roughness: 0.9 });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.set(0, -0.45, -0.2);
        tail.rotation.x = 0.7;
        tarsierGroup.add(tail);

        // Scale down overall — they are tiny
        tarsierGroup.scale.setScalar(0.55);
        this.group.add(tarsierGroup);
        this.group.userData.tarsier = this;
    }

    /**
     * Notify this tarsier of a nearby sling-arc cheer event.
     * Called externally when the player performs a clean sling exit near the anchor.
     */
    triggerCheer(): void {
        this.state = 'cheering';
        this.stateTimer = 0;
    }

    /**
     * Notify this tarsier of a nearby projectile/disturbance.
     * Called externally when a shot passes close to the anchor.
     */
    triggerPanic(): void {
        if (this.state !== 'panicking') {
            this.state = 'panicking';
            this.stateTimer = 0;
        }
    }

    update(dt: number, playerPos: THREE.Vector3): InteractionResult | null {
        this.time += dt;
        this.stateTimer += dt;

        // --- Determine next state from environment ---
        const distToPlayer = playerPos.distanceTo(this.position);

        if (this.state === 'idle' || this.state === 'alarmed') {
            if (distToPlayer < this.PANIC_DISTANCE) {
                this.state = 'panicking';
                this.stateTimer = 0;
            } else if (distToPlayer < this.ALARM_DISTANCE) {
                if (this.state === 'idle') {
                    this.state = 'alarmed';
                    this.stateTimer = 0;
                }
            } else if (this.state === 'alarmed' && this.stateTimer > this.ALARMED_DURATION) {
                this.state = 'idle';
                this.stateTimer = 0;
            }
        }

        // --- State duration resets ---
        if (this.state === 'panicking' && this.stateTimer > this.PANIC_DURATION) {
            this.state = 'idle';
            this.stateTimer = 0;
        }
        if (this.state === 'cheering' && this.stateTimer > this.CHEER_DURATION) {
            this.state = 'idle';
            this.stateTimer = 0;
        }

        // --- Position: orbit / flee ---
        let targetX: number;
        let targetY: number;

        if (this.state === 'panicking') {
            // Flee slightly away from player along the orbital arc
            const fleeAngle = this.orbitAngle + this.stateTimer * 2.5;
            const fleeRadius = this.orbitRadius + this.stateTimer * 1.5;
            targetX = this.anchorPos.x + Math.cos(fleeAngle) * Math.min(fleeRadius, this.orbitRadius + 5);
            targetY = this.anchorPos.y + Math.sin(fleeAngle) * Math.min(fleeRadius, this.orbitRadius + 5) * 0.6;
        } else {
            // Gentle orbital drift
            const drift = Math.sin(this.time * 0.4 + this.phaseOffset) * 0.15;
            targetX = this.anchorPos.x + Math.cos(this.orbitAngle + drift) * this.orbitRadius;
            targetY = this.anchorPos.y + Math.sin(this.orbitAngle + drift) * this.orbitRadius * 0.6;
        }

        // Smooth movement toward target position
        this.position.x = THREE.MathUtils.lerp(this.position.x, targetX, dt * 3);
        this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, dt * 3);
        this.position.z = this.orbitZ;
        this.group.position.copy(this.position);

        // --- Animations by state ---
        this._animateByState(dt, playerPos);

        // --- Emit interaction events ---
        if (this.state === 'cheering' && this.stateTimer < dt * 2) {
            // Just entered cheering state — emit cheer event once
            return { type: 'tarsier_cheer', position: this.position.clone() };
        }
        if (this.state === 'panicking' && this.stateTimer < dt * 2) {
            // Just entered panicking state — emit panic event once
            return { type: 'tarsier_panic', position: this.position.clone() };
        }

        return null;
    }

    private _animateByState(dt: number, playerPos: THREE.Vector3): void {
        if (!this.headGroup || !this.leftEar || !this.rightEar) return;

        switch (this.state) {
            case 'idle': {
                // Gentle bob
                this.group.position.y = this.position.y + Math.sin(this.time * 1.8 + this.phaseOffset) * 0.1;
                // Slow head tilt
                this.headGroup.rotation.z = Math.sin(this.time * 0.7 + this.phaseOffset) * 0.12;
                this.headGroup.rotation.y = Math.sin(this.time * 0.5 + this.phaseOffset) * 0.15;
                // Ears relax
                this.leftEar.rotation.z = 0.1;
                this.rightEar.rotation.z = -0.1;
                // Occasional look toward anchor core
                this.headGroup.lookAt(
                    this.anchorPos.x,
                    this.anchorPos.y,
                    this.headGroup.getWorldPosition(new THREE.Vector3()).z
                );
                break;
            }
            case 'alarmed': {
                // Freeze + wide eyes + look at player
                const toPlayer = new THREE.Vector3(playerPos.x, playerPos.y, this.position.z);
                this.headGroup.lookAt(toPlayer);
                // Ear alert
                this.leftEar.rotation.z = 0.3;
                this.rightEar.rotation.z = -0.3;
                // Small tremble
                this.group.position.x = this.position.x + Math.sin(this.time * 25) * 0.03;
                // Eyes slightly enlarged
                if (this.leftEye) this.leftEye.scale.setScalar(1.15);
                if (this.rightEye) this.rightEye.scale.setScalar(1.15);
                break;
            }
            case 'panicking': {
                // Rapid bounce
                const bounceY = Math.abs(Math.sin(this.time * 14)) * 0.25;
                this.group.position.y = this.position.y + bounceY;
                this.group.rotation.z = Math.sin(this.time * 20) * 0.18;
                // Ears flap back
                this.leftEar.rotation.z = Math.sin(this.time * 12) * 0.4 - 0.3;
                this.rightEar.rotation.z = Math.sin(this.time * 12 + 0.5) * 0.4 + 0.3;
                // Eyes reset
                if (this.leftEye) this.leftEye.scale.setScalar(1.0);
                if (this.rightEye) this.rightEye.scale.setScalar(1.0);
                break;
            }
            case 'cheering': {
                // Synchronized cheer jump
                const cheerT = this.stateTimer / this.CHEER_DURATION;
                const jumpArc = Math.sin(cheerT * Math.PI) * 0.6;
                this.group.position.y = this.position.y + jumpArc;
                // Happy ears flapping up
                this.leftEar.rotation.z = 0.5 + Math.sin(this.time * 15) * 0.2;
                this.rightEar.rotation.z = -0.5 + Math.sin(this.time * 15 + 0.3) * 0.2;
                // Head tilts up joyfully
                this.headGroup.rotation.x = -0.35;
                this.headGroup.rotation.z = Math.sin(this.time * 8) * 0.15;
                // Eyes reset
                if (this.leftEye) this.leftEye.scale.setScalar(1.0);
                if (this.rightEye) this.rightEye.scale.setScalar(1.0);
                break;
            }
        }
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
}
