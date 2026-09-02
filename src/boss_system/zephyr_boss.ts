import * as THREE from 'three';
import { decorationBudget } from '../decoration_budget';
import { time, vec3, color, uniform, sin, cos, float, positionLocal, normalLocal } from 'three/tsl';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { PHASE_NAMES, type BossConfig, type BossHitboxEntry, type BossPhase } from './types';

export class ZephyrBoss {
    scene: THREE.Scene;
    group: THREE.Group;
    config: BossConfig;

    phase: BossPhase = 'entering';
    health: number;
    maxHealth: number;
    isActive = false;
    time = 0;

    rageTimer = 0;
    private lastPhase: BossPhase = 'entering';

    weakPointExposed = false;

    pullForceY = 0;
    pullForceX = 0;
    isSnapping = false;

    coreMesh!: THREE.Mesh;
    windRings: THREE.Mesh[] = [];
    outerHurricane!: THREE.Mesh;
    glowLight!: THREE.PointLight;

    onDefeated: () => void;
    onPlayerHit: () => void;
    onPhaseChange?: (phase: BossPhase) => void;
    getPlayerPosition: () => THREE.Vector3 | null;

    constructor(
        scene: THREE.Scene,
        config: BossConfig,
        callbacks: {
            onDefeated: () => void;
            onPlayerHit: () => void;
            onPhaseChange?: (phase: BossPhase) => void;
            getPlayerPosition: () => THREE.Vector3 | null;
        }
    ) {
        this.scene = scene;
        this.config = config;
        this.health = this.maxHealth = config.health;
        this.onDefeated = callbacks.onDefeated;
        this.onPlayerHit = callbacks.onPlayerHit;
        this.onPhaseChange = callbacks.onPhaseChange;
        this.getPlayerPosition = callbacks.getPlayerPosition;

        this.group = new THREE.Group();
        this.group.position.set(config.spawnX + 150, 0, -2);
        this.buildVisuals();
    }

    activate(startX: number): void {
        if (!decorationBudget.canSpawn('star_eater_boss')) {
            console.warn('Zephyr Boss blocked by decoration budget');
            return;
        }
        decorationBudget.reportSpawn('star_eater_boss');
        this.isActive = true;
        this.group.position.x = startX + 120;
        this.setPhase('entering');
        this.scene.add(this.group);
    }

    destroy(): void {
        this.isActive = false;
        decorationBudget.reportDestroy('star_eater_boss');
        this.scene.remove(this.group);

        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }

    private buildVisuals() {
        // 1. Core Orb
        const coreGeo = new THREE.SphereGeometry(4, 32, 32);
        const coreMat = new MeshStandardNodeMaterial({
            roughness: 0.1,
            metalness: 0.8,
            transparent: true,
            opacity: 0.9,
            depthWrite: true
        });

        const corePulse = sin(time.mul(2.0)).mul(0.2).add(0.8);
        coreMat.colorNode = color(0x00ffff).mul(corePulse);
        coreMat.emissiveNode = color(0x00ffff).mul(corePulse.mul(0.5));

        this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
        this.group.add(this.coreMesh);

        // 2. Wind Rings
        const ringGeo = new THREE.TorusGeometry(8, 0.5, 16, 64);
        for(let i=0; i<3; i++) {
            const ringMat = new MeshBasicNodeMaterial({
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const t = time.mul(3.0).add(i * 2.0);
            ringMat.colorNode = color(0x88ffff).mul(sin(t).mul(0.5).add(0.5));

            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.random() * Math.PI;
            ring.rotation.y = Math.random() * Math.PI;
            this.windRings.push(ring);
            this.group.add(ring);
        }

        // 3. Outer Hurricane Shield
        const stormGeo = new THREE.SphereGeometry(12, 32, 32);
        const stormMat = new MeshBasicNodeMaterial({
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const stormSway = sin(time.mul(5.0).add(positionLocal.y)).mul(0.5);
        stormMat.colorNode = color(0xaaffff).mul(stormSway.add(0.5));

        this.outerHurricane = new THREE.Mesh(stormGeo, stormMat);
        this.group.add(this.outerHurricane);

        // 4. Glow
        this.glowLight = new THREE.PointLight(0x00ffff, 2.0, 100);
        this.group.add(this.glowLight);
    }

    private setPhase(next: BossPhase): void {
        this.phase = next;
        this.time = 0;
    }

    getHealthRatio(): number {
        return this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    }

    isRaging(): boolean {
        return this.rageTimer > 0;
    }

    getPhaseName(): string {
        return PHASE_NAMES[this.phase] ?? this.phase.toUpperCase();
    }

    takeDamage(amount: number, target: 'boss' | number = 'boss'): boolean {
        if (!this.isActive || this.phase === 'defeated') return false;

        if (!this.weakPointExposed) return false;

        this.health -= amount;
        this.flashGroup();

        if (this.health <= 0) {
            this.health = 0;
            this.setPhase('defeated');
            this.onDefeated();
        }

        return true;
    }

    private flashGroup(): void {
        const mat = this.coreMesh.material as any;
        if (!mat) return;
        const oldColor = mat.colorNode;
        mat.colorNode = color(0xffffff);
        setTimeout(() => {
            if (this.isActive) {
                mat.colorNode = oldColor;
            }
        }, 100);
    }

    collectWasmHitboxes(): BossHitboxEntry[] {
        const boxes: BossHitboxEntry[] = [];
        const coreX = this.group.position.x;
        const coreY = this.group.position.y;

        if (this.weakPointExposed) {
            boxes.push({ x: coreX, y: coreY, radius: 4, target: 'boss', dealsDamage: true });
        } else {
            boxes.push({ x: coreX, y: coreY, radius: 8, target: 'boss', dealsDamage: false });
        }

        return boxes;
    }

    resolveHitboxEntry(hitboxIndex: number): BossHitboxEntry | null {
        return this.collectWasmHitboxes()[hitboxIndex] ?? null;
    }

    update(delta: number): { pullForce: number; isSnapping: boolean } {
        if (!this.isActive) return { pullForce: 0, isSnapping: false };

        this.time += delta;
        if (this.rageTimer > 0) this.rageTimer -= delta;

        // Visual animations
        this.windRings.forEach((ring, index) => {
            ring.rotation.x += delta * (1.0 + index * 0.5);
            ring.rotation.y += delta * (1.5 - index * 0.2);
        });

        let currentPullForce = 0;
        this.pullForceY = 0;
        this.isSnapping = false;

        switch (this.phase) {
            case 'entering':
                this.updateEntering(delta);
                break;
            case 'phase1': // Gale
                currentPullForce = this.updateGale(delta);
                break;
            case 'phase2': // Shear
                currentPullForce = this.updateShear(delta);
                break;
            case 'phase3': // Eye
                currentPullForce = this.updateEye(delta);
                break;
            case 'defeated':
                this.updateDefeated(delta);
                break;
        }

        if (this.phase !== this.lastPhase) {
            if (this.onPhaseChange) this.onPhaseChange(this.phase);
            this.lastPhase = this.phase;
        }

        // Apply Y shear to group so player pull is affected
        this.group.position.y = Math.sin(this.time * 2.0) * 5 + this.pullForceY;

        return { pullForce: currentPullForce, isSnapping: this.isSnapping };
    }

    private updateEntering(delta: number) {
        if (this.group.position.x > this.config.spawnX + 40) {
            this.group.position.x -= delta * 15;
        } else {
            this.setPhase('phase1');
            console.log('🌪️ Zephyr entering Phase 1 - GALE');
        }
    }

    private updateGale(delta: number): number {
        // High pull force, shield is up
        this.weakPointExposed = false;
        if (this.outerHurricane) this.outerHurricane.visible = true;

        const cycle = this.time % 12;
        if (cycle > 10) {
            this.setPhase('phase2');
            console.log('🌪️ Zephyr entering Phase 2 - SHEAR');
            return 0;
        }

        return THREE.MathUtils.lerp(8, 15, Math.min(1, this.time / 5));
    }

    private updateShear(delta: number): number {
        // Shifting updraft/downdrafts
        this.weakPointExposed = false;
        if (this.outerHurricane) this.outerHurricane.visible = true;

        const cycle = this.time % 10;
        if (cycle > 8) {
            this.setPhase('phase3');
            console.log('🌪️ Zephyr entering Phase 3 - EYE');
            return 0;
        }

        this.pullForceY = Math.sin(this.time * 3.0) * 20; // Vertical shear
        return 5; // Moderate horizontal pull
    }

    private updateEye(delta: number): number {
        // Core exposed, calm winds
        this.weakPointExposed = true;
        if (this.outerHurricane) this.outerHurricane.visible = false;

        const cycle = this.time % 8;
        if (cycle > 6) {
            this.setPhase('phase1');
            console.log('🌪️ Zephyr returning to Phase 1 - GALE');
            return 0;
        }

        return 2; // Very weak pull
    }

    private updateDefeated(delta: number) {
        this.weakPointExposed = false;
        if (this.outerHurricane) this.outerHurricane.visible = false;
        this.group.position.y -= delta * 10;
        this.group.rotation.z += delta * 5;
    }
}
