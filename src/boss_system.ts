import * as THREE from 'three';
import { decorationBudget } from './decoration_budget';

export type BossPhase = 'entering' | 'phase1' | 'phase2' | 'phase3' | 'defeated';

export { STAR_EATER_PITCHER_NAME as BOSS_DISPLAY_NAME } from './boss_display_names';

const PHASE_NAMES: Record<BossPhase, string> = {
    entering: 'APPROACH',
    phase1: 'SUCTION',
    phase2: 'ENRAGED',
    phase3: 'DESPERATION',
    defeated: 'DEFEATED'
};

export interface BossConfig {
    spawnX: number;
    arenaWidth: number;
    health: number;
}

export interface BossHitboxEntry {
    x: number;
    y: number;
    radius: number;
    /** 'boss' = uvula weak point; number = minion index */
    target: 'boss' | number;
    dealsDamage: boolean;
}

/** Smaller orbiting pitcher minion — destroying one shaves 10% off the main boss. */
class PitcherMinion {
    group: THREE.Group;
    orbitAngle: number;
    orbitRadius: number;
    orbitSpeed: number;
    health = 30;
    alive = true;

    constructor(parent: THREE.Group, index: number, total: number) {
        this.orbitAngle = (index / total) * Math.PI * 2;
        this.orbitRadius = 28 + Math.random() * 12;
        this.orbitSpeed = 0.25 + Math.random() * 0.15;

        this.group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(1.8, 3, 6, 8),
            new THREE.MeshStandardMaterial({
                color: 0x2a1040,
                emissive: 0x660044,
                emissiveIntensity: 0.5,
                roughness: 0.85
            })
        );
        body.rotation.z = Math.PI / 2;
        this.group.add(body);

        const mouth = new THREE.Mesh(
            new THREE.ConeGeometry(1.2, 2, 12, 1, true),
            new THREE.MeshStandardMaterial({
                color: 0x110011,
                emissive: 0xff0044,
                emissiveIntensity: 0.8,
                side: THREE.DoubleSide
            })
        );
        mouth.rotation.z = -Math.PI / 2;
        mouth.position.x = 1.5;
        this.group.add(mouth);

        parent.add(this.group);
        decorationBudget.reportSpawn('star_eater_minions');
    }

    update(delta: number, center: THREE.Vector3, time: number): void {
        if (!this.alive) return;
        this.orbitAngle += delta * this.orbitSpeed;
        this.group.position.set(
            center.x + Math.cos(this.orbitAngle) * this.orbitRadius,
            center.y + Math.sin(this.orbitAngle) * this.orbitRadius * 0.55,
            center.z + Math.sin(time * 0.7 + this.orbitAngle) * 4
        );
        this.group.lookAt(center);
    }

    takeDamage(amount: number): boolean {
        if (!this.alive) return false;
        this.health -= amount;
        if (this.health <= 0) {
            this.alive = false;
            this.group.visible = false;
            decorationBudget.reportDestroy('star_eater_minions');
            return true;
        }
        return false;
    }

    getHitbox(): { x: number; y: number; radius: number } {
        return {
            x: this.group.position.x,
            y: this.group.position.y,
            radius: 2.5
        };
    }

    destroy(): void {
        if (this.alive) {
            decorationBudget.reportDestroy('star_eater_minions');
            this.alive = false;
        }
    }
}

export class StarEaterBoss {
    scene: THREE.Scene;
    group: THREE.Group;
    config: BossConfig;

    phase: BossPhase = 'entering';
    health: number;
    maxHealth: number;
    isActive = false;
    time = 0;

    mouth!: THREE.Mesh;
    jaw!: THREE.Mesh;
    uvula!: THREE.Mesh;
    teeth: THREE.Mesh[] = [];
    accretionDisk!: THREE.Points;
    glowLight!: THREE.PointLight;

    minions: PitcherMinion[] = [];
    rageTimer = 0;
    private lastPhase: BossPhase = 'entering';

    debrisTimer = 0;
    weakPointExposed = false;

    pullStrength = 0;

    onDefeated: () => void;
    onPlayerHit: () => void;
    onPhaseChange?: (phase: BossPhase) => void;
    getPlayerPosition: () => THREE.Vector3 | null;
    spawnDebris: (pos: THREE.Vector3, homing?: boolean) => void;

    constructor(
        scene: THREE.Scene,
        config: BossConfig,
        callbacks: {
            onDefeated: () => void;
            onPlayerHit: () => void;
            onPhaseChange?: (phase: BossPhase) => void;
            getPlayerPosition: () => THREE.Vector3 | null;
            spawnDebris: (pos: THREE.Vector3, homing?: boolean) => void;
        }
    ) {
        this.scene = scene;
        this.config = config;
        this.health = config.health;
        this.maxHealth = config.health;
        this.onDefeated = callbacks.onDefeated;
        this.onPlayerHit = callbacks.onPlayerHit;
        this.onPhaseChange = callbacks.onPhaseChange;
        this.getPlayerPosition = callbacks.getPlayerPosition;
        this.spawnDebris = callbacks.spawnDebris;

        this.group = new THREE.Group();
        this.createVisuals();
        this.group.visible = false;
        scene.add(this.group);
    }

    private createVisuals(): void {
        const bodyGeo = new THREE.CapsuleGeometry(6, 12, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x1a0a2e,
            roughness: 0.9,
            metalness: 0.1,
            emissive: 0x330066,
            emissiveIntensity: 0.3
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2;
        this.group.add(body);

        const mouthGeo = new THREE.ConeGeometry(5, 8, 32, 1, true);
        const mouthMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 1,
            side: THREE.DoubleSide,
            emissive: 0xff0044,
            emissiveIntensity: 0.5
        });
        this.mouth = new THREE.Mesh(mouthGeo, mouthMat);
        this.mouth.rotation.z = -Math.PI / 2;
        this.mouth.position.x = 8;
        this.group.add(this.mouth);

        const jawGeo = new THREE.ConeGeometry(4.5, 6, 32, 1, true);
        const jawMat = new THREE.MeshStandardMaterial({
            color: 0x1a0a2e,
            roughness: 0.8,
            side: THREE.DoubleSide
        });
        this.jaw = new THREE.Mesh(jawGeo, jawMat);
        this.jaw.rotation.z = -Math.PI / 2;
        this.jaw.position.x = 7;
        this.jaw.position.y = -2;
        this.group.add(this.jaw);

        const uvulaGeo = new THREE.SphereGeometry(1.5, 16, 16);
        const uvulaMat = new THREE.MeshStandardMaterial({
            color: 0xff0044,
            emissive: 0xff0044,
            emissiveIntensity: 2,
            roughness: 0.3
        });
        this.uvula = new THREE.Mesh(uvulaGeo, uvulaMat);
        this.uvula.position.set(10, 0, 0);
        this.uvula.visible = false;
        this.group.add(this.uvula);

        for (let i = 0; i < 8; i++) {
            const toothGeo = new THREE.ConeGeometry(0.4, 1.5, 8);
            const toothMat = new THREE.MeshStandardMaterial({
                color: 0xccffff,
                roughness: 0.1,
                metalness: 0.9,
                emissive: 0x44aaff,
                emissiveIntensity: 0.3
            });
            const tooth = new THREE.Mesh(toothGeo, toothMat);

            const angle = (i / 8) * Math.PI;
            const radius = 4;
            tooth.position.set(
                6 + Math.cos(angle) * radius * 0.3,
                Math.sin(angle) * radius,
                0
            );
            tooth.rotation.z = angle - Math.PI / 2;

            this.teeth.push(tooth);
            this.group.add(tooth);
        }

        const diskGeo = new THREE.BufferGeometry();
        const particleCount = 2000;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 8 + Math.random() * 12;
            const height = (Math.random() - 0.5) * 2;

            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = height;
            positions[i * 3 + 2] = Math.sin(angle) * radius;

            colors[i * 3] = 0.8 + Math.random() * 0.2;
            colors[i * 3 + 1] = 0.2 + Math.random() * 0.3;
            colors[i * 3 + 2] = 0.6 + Math.random() * 0.4;
        }

        diskGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        diskGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const diskMat = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.8
        });

        this.accretionDisk = new THREE.Points(diskGeo, diskMat);
        this.group.add(this.accretionDisk);

        this.glowLight = new THREE.PointLight(0xff0044, 3, 50);
        this.glowLight.position.set(8, 0, 0);
        this.group.add(this.glowLight);
    }

    activate(startX: number): void {
        if (!decorationBudget.canSpawn('star_eater_boss')) {
            console.warn('Star-Eater Pitcher blocked by decoration budget');
            return;
        }
        decorationBudget.reportSpawn('star_eater_boss');

        this.isActive = true;
        this.group.visible = true;
        this.group.position.set(startX + 50, 0, -20);
        this.phase = 'entering';
        this.lastPhase = 'entering';
        this.health = this.maxHealth;
        this.time = 0;
        this.rageTimer = 0;
        this.debrisTimer = 0;

        const minionCount = 2 + Math.floor(Math.random() * 3);
        this.minions = [];
        for (let i = 0; i < minionCount; i++) {
            this.minions.push(new PitcherMinion(this.group, i, minionCount));
        }

        console.log('👹 Star-Eater Pitcher ACTIVATED!');
    }

    update(delta: number): { pullForce: number; isSnapping: boolean } {
        if (!this.isActive) return { pullForce: 0, isSnapping: false };

        this.time += delta;
        if (this.rageTimer > 0) this.rageTimer -= delta;

        const result = { pullForce: 0, isSnapping: false };
        const rageMult = this.rageTimer > 0 ? 1.25 : 1;

        this.accretionDisk.rotation.y += delta * 0.2;
        this.accretionDisk.rotation.x = Math.sin(this.time * 0.5) * 0.1;

        this.teeth.forEach((tooth, i) => {
            tooth.rotation.z += delta * (0.5 + i * 0.1);
        });

        const center = this.group.position;
        for (const minion of this.minions) {
            minion.update(delta, center, this.time);
        }

        switch (this.phase) {
            case 'entering':
                this.updateEntering(delta);
                break;
            case 'phase1':
                result.pullForce = this.updatePhase1(delta) * rageMult;
                break;
            case 'phase2':
                result.pullForce = this.updatePhase2(delta) * rageMult;
                result.isSnapping = this.checkMouthSnap();
                break;
            case 'phase3':
                result.pullForce = this.updatePhase3(delta) * rageMult;
                break;
            case 'defeated':
                this.updateDefeated(delta);
                break;
        }

        this.maybeFirePhaseStinger();

        const pulse = Math.sin(this.time * 3) * 0.3 + 0.7;
        this.glowLight.intensity = (2 + pulse * 2) * (this.rageTimer > 0 ? 1.4 : 1);

        return result;
    }

    private maybeFirePhaseStinger(): void {
        if (this.phase !== this.lastPhase && this.phase !== 'entering' && this.phase !== 'defeated') {
            this.onPhaseChange?.(this.phase);
            this.lastPhase = this.phase;
        }
    }

    private updateEntering(delta: number): void {
        const targetX = this.config.spawnX + 30;
        this.group.position.x += (targetX - this.group.position.x) * delta;

        if (Math.abs(targetX - this.group.position.x) < 1) {
            this.setPhase('phase1');
            console.log('👹 Boss entering Phase 1 - SUCTION');
        }
    }

    private setPhase(next: BossPhase): void {
        this.phase = next;
        this.time = 0;
        this.debrisTimer = 0;
    }

    private updatePhase1(_delta: number): number {
        // Pull 5→8 m/s²; uvula exposed ~2s every 8s; debris every 4s
        this.pullStrength = THREE.MathUtils.lerp(5, 8, Math.min(1, this.time / 10));

        const cycle = this.time % 8;
        const mouthOpen = cycle < 2 ? 0.85 : 0.25 + Math.sin(this.time * 0.8) * 0.15;
        this.mouth.scale.y = 0.3 + mouthOpen * 0.7;
        this.jaw.rotation.z = -Math.PI / 2 - mouthOpen * 0.5;

        this.weakPointExposed = cycle < 2;
        this.uvula.visible = this.weakPointExposed;
        (this.mouth.material as THREE.MeshStandardMaterial).emissiveIntensity =
            this.weakPointExposed ? 1.2 : 0.5;

        this.debrisTimer += _delta;
        if (this.debrisTimer > 4) {
            this.debrisTimer = 0;
            this.spawnMouthDebris();
        }

        if (this.health / this.maxHealth <= 0.7) {
            this.setPhase('phase2');
            console.log('👹 Boss entering Phase 2 - ENRAGED!');
        }

        return this.pullStrength;
    }

    private updatePhase2(_delta: number): number {
        this.pullStrength = 12;

        const cycle = this.time % 6;
        const mouthOpen = cycle < 1 ? 0.9 : 0.2 + Math.sin(this.time * 1.2) * 0.2;
        this.mouth.scale.y = 0.2 + mouthOpen * 0.8;
        this.jaw.rotation.z = -Math.PI / 2 - mouthOpen * 0.7;

        this.weakPointExposed = cycle < 1;
        this.uvula.visible = this.weakPointExposed;

        this.debrisTimer += _delta;
        if (this.debrisTimer > 6) {
            this.debrisTimer = 0;
            for (let i = 0; i < 3; i++) {
                setTimeout(() => this.spawnMouthDebris(), i * 300);
            }
        }

        if (this.health / this.maxHealth <= 0.3) {
            this.setPhase('phase3');
            console.log('👹 Boss entering Phase 3 - DESPERATION!');
        }

        return this.pullStrength;
    }

    private checkMouthSnap(): boolean {
        const snapCycle = this.time % 5;
        return snapCycle < 0.5;
    }

    private updatePhase3(_delta: number): number {
        const swirl = Math.sin(this.time * 2) * 5;
        this.pullStrength = 3;

        const pulse = Math.sin(this.time * 4) * 0.3 + 0.7;
        this.mouth.scale.y = 0.6 + pulse * 0.4;
        this.jaw.rotation.z = -Math.PI / 2 - pulse * 0.5;

        this.weakPointExposed = true;
        this.uvula.visible = true;

        this.teeth.forEach((tooth, i) => {
            const angle = (this.time * 2 + i * Math.PI / 4) % (Math.PI * 2);
            tooth.position.x = 6 + Math.cos(angle) * 3;
            tooth.position.y = Math.sin(angle) * 3;
        });

        this.debrisTimer += _delta;
        if (this.debrisTimer > 2) {
            this.debrisTimer = 0;
            this.spawnMouthDebris();
            this.spawnMouthDebris(true);
        }

        return this.pullStrength + swirl * 0.5;
    }

    private updateDefeated(_delta: number): void {
        this.group.scale.multiplyScalar(0.95);
        this.group.rotation.z += _delta * 2;

        const flash = Math.sin(this.time * 20) > 0;
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                const mat = child.material as THREE.MeshStandardMaterial;
                mat.emissiveIntensity = flash ? 5 : 0;
            }
        });

        if (this.group.scale.x < 0.01) {
            this.destroy();
        }
    }

    private spawnMouthDebris(homing = false): void {
        const mouthPos = new THREE.Vector3(
            this.group.position.x + 8,
            this.group.position.y + (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 4
        );
        this.spawnDebris(mouthPos, homing);
    }

    /** Apply damage to uvula weak point or a minion hitbox index. Returns true if damage landed. */
    takeDamage(amount: number, target: 'boss' | number = 'boss'): boolean {
        if (!this.isActive || this.phase === 'defeated') return false;

        if (typeof target === 'number') {
            const minion = this.minions[target];
            if (!minion?.alive) return false;
            if (minion.takeDamage(amount)) {
                this.health = Math.max(0, this.health - this.maxHealth * 0.1);
                this.rageTimer = 15;
                this.flashGroup();
                if (this.health <= 0) {
                    this.health = 0;
                    this.setPhase('defeated');
                    this.onDefeated();
                }
            }
            return true;
        }

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
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                const mat = child.material as THREE.MeshStandardMaterial;
                const originalEmissive = mat.emissive.clone();
                mat.emissive.setHex(0xffffff);
                mat.emissiveIntensity = 2;
                setTimeout(() => {
                    mat.emissive.copy(originalEmissive);
                    mat.emissiveIntensity = 0.3;
                }, 100);
            }
        });
    }

    /** All WASM-ready hitboxes: uvula (when exposed), body shield, and living minions. */
    collectWasmHitboxes(): BossHitboxEntry[] {
        const boxes: BossHitboxEntry[] = [];
        const mouthX = this.group.position.x + 8;
        const mouthY = this.group.position.y;

        if (this.weakPointExposed) {
            boxes.push({ x: mouthX, y: mouthY, radius: 2, target: 'boss', dealsDamage: true });
        } else {
            boxes.push({ x: mouthX, y: mouthY, radius: 6, target: 'boss', dealsDamage: false });
        }

        for (let i = 0; i < this.minions.length; i++) {
            const minion = this.minions[i];
            if (minion.alive) {
                const hb = minion.getHitbox();
                boxes.push({ ...hb, target: i, dealsDamage: true });
            }
        }

        return boxes;
    }

    resolveHitboxEntry(hitboxIndex: number): BossHitboxEntry | null {
        return this.collectWasmHitboxes()[hitboxIndex] ?? null;
    }

    getHitbox(): { center: THREE.Vector3; radius: number } {
        return {
            center: new THREE.Vector3(
                this.group.position.x + 8,
                this.group.position.y,
                this.group.position.z
            ),
            radius: this.weakPointExposed ? 2 : 6
        };
    }

    getHealthRatio(): number {
        return this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    }

    getPhase(): BossPhase {
        return this.phase;
    }

    getPhaseName(): string {
        return PHASE_NAMES[this.phase] ?? this.phase.toUpperCase();
    }

    isRaging(): boolean {
        return this.rageTimer > 0;
    }

    destroy(): void {
        this.isActive = false;
        for (const minion of this.minions) minion.destroy();
        this.minions = [];
        decorationBudget.reportDestroy('star_eater_boss');
        this.scene.remove(this.group);

        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            } else if (child instanceof THREE.Points) {
                child.geometry.dispose();
                (child.material as THREE.Material).dispose();
            }
        });
    }
}

export class BossManager {
    private scene: THREE.Scene;
    private currentBoss: StarEaterBoss | null = null;
    private bossSpawned = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    checkBossSpawn(
        playerX: number,
        level: number,
        levelDistance: number | undefined,
        callbacks: {
            onDefeated: () => void;
            onPlayerHit: () => void;
            onPhaseChange?: (phase: BossPhase) => void;
            getPlayerPosition: () => THREE.Vector3 | null;
            spawnDebris: (pos: THREE.Vector3, homing?: boolean) => void;
            onBossStart: () => void;
        }
    ): boolean {
        // Level 6 capstone: Star-Eater Pitcher near the end of the aqua expanse
        const isLevel6Capstone = level === 6 && !this.bossSpawned && levelDistance
            && playerX > levelDistance - 750;

        if (!isLevel6Capstone) return false;

        this.bossSpawned = true;

        this.currentBoss = new StarEaterBoss(
            this.scene,
            {
                spawnX: playerX,
                arenaWidth: 60,
                health: 300
            },
            callbacks
        );

        this.currentBoss.activate(playerX);
        callbacks.onBossStart();
        return true;
    }

    update(delta: number): {
        bossActive: boolean;
        pullForce: number;
        isSnapping: boolean;
        boss?: StarEaterBoss;
    } {
        if (!this.currentBoss) {
            return { bossActive: false, pullForce: 0, isSnapping: false };
        }

        const result = this.currentBoss.update(delta);

        return {
            bossActive: this.currentBoss.isActive,
            pullForce: result.pullForce,
            isSnapping: result.isSnapping,
            boss: this.currentBoss
        };
    }

    reset(): void {
        if (this.currentBoss) {
            this.currentBoss.destroy();
            this.currentBoss = null;
        }
        this.bossSpawned = false;
    }

    getBoss(): StarEaterBoss | null {
        return this.currentBoss;
    }
}
