const fs = require('fs');

// 1. boss_display_names.ts
let bd = fs.readFileSync('src/boss_display_names.ts', 'utf8');
if(!bd.includes('ZEPHYR_NAME')) {
    bd += "\nexport const ZEPHYR_NAME = 'THE ZEPHYR';\n";
    fs.writeFileSync('src/boss_display_names.ts', bd);
}

// 2. zephyr_boss.ts
const zephyrCode = `import * as THREE from 'three';
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
`;
fs.writeFileSync('src/boss_system/zephyr_boss.ts', zephyrCode);

// 3. index.ts
let idx = fs.readFileSync('src/boss_system/index.ts', 'utf8');
if(!idx.includes('ZephyrBoss')) {
    idx = idx.replace("export { BossManager }", "export { ZephyrBoss } from './zephyr_boss';\nexport { BossManager }");
    fs.writeFileSync('src/boss_system/index.ts', idx);
}

// 4. boss_manager.ts
const bmCode = `import * as THREE from 'three';
import { StarEaterBoss } from './star_eater_boss';
import { ZephyrBoss } from './zephyr_boss';
import type { BossPhase } from './types';

export class BossManager {
    private scene: THREE.Scene;
    private currentBoss: StarEaterBoss | ZephyrBoss | null = null;
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
        // Level 4 capstone: Zephyr Boss
        const isLevel4Capstone = level === 4 && !this.bossSpawned && levelDistance
            && playerX > levelDistance - 500;

        // Level 6 capstone: Star-Eater Pitcher near the end of the aqua expanse
        const isLevel6Capstone = level === 6 && !this.bossSpawned && levelDistance
            && playerX > levelDistance - 750;

        if (!isLevel4Capstone && !isLevel6Capstone) return false;

        this.bossSpawned = true;

        if (isLevel4Capstone) {
            this.currentBoss = new ZephyrBoss(
                this.scene,
                {
                    spawnX: playerX,
                    arenaWidth: 60,
                    health: 200
                },
                callbacks
            );
        } else if (isLevel6Capstone) {
            this.currentBoss = new StarEaterBoss(
                this.scene,
                {
                    spawnX: playerX,
                    arenaWidth: 60,
                    health: 300
                },
                callbacks
            );
        }

        if (this.currentBoss) {
            this.currentBoss.activate(playerX);
            callbacks.onBossStart();
        }
        return true;
    }

    update(delta: number): {
        bossActive: boolean;
        pullForce: number;
        pullForceY: number;
        isSnapping: boolean;
        boss?: StarEaterBoss | ZephyrBoss;
    } {
        if (!this.currentBoss) {
            return { bossActive: false, pullForce: 0, pullForceY: 0, isSnapping: false };
        }

        const result = this.currentBoss.update(delta);

        let pullForceY = 0;
        if (this.currentBoss instanceof ZephyrBoss) {
            pullForceY = this.currentBoss.pullForceY;
        }

        return {
            bossActive: this.currentBoss.isActive,
            pullForce: result.pullForce,
            pullForceY: pullForceY,
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

    getBoss(): StarEaterBoss | ZephyrBoss | null {
        return this.currentBoss;
    }
}
`;
fs.writeFileSync('src/boss_system/boss_manager.ts', bmCode);

// 5. boss_health_ui.ts
const huiCode = `import type { NebulaKraken } from '../space_robot_squid';
import type { StarEaterBoss, ZephyrBoss } from '../boss_system';
import { NEBULA_KRAKEN_NAME as KRAKEN_NAME, STAR_EATER_PITCHER_NAME as PITCHER_NAME, ZEPHYR_NAME } from '../boss_display_names';

// BOSS HEALTH BAR UI
// =============================================================================
let bossHealthBar: HTMLDivElement | null = null;
let bossHealthFill: HTMLDivElement | null = null;
let bossHealthLabel: HTMLDivElement | null = null;
let activeBossKind: 'kraken' | 'pitcher' | 'zephyr' | null = null;

function ensureBossHealthBar(borderColor: string, gradient: string): void {
    if (bossHealthBar) return;

    bossHealthBar = document.createElement('div');
    bossHealthBar.id = 'boss-health-bar';
    bossHealthBar.style.cssText = \`
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        width: 320px; height: 18px; background: #111; border: 2px solid \${borderColor};
        border-radius: 9px; overflow: hidden; z-index: 100;
        box-shadow: 0 0 15px \${borderColor}55, inset 0 0 6px #000;
    \`;

    bossHealthFill = document.createElement('div');
    bossHealthFill.style.cssText = \`
        width: 100%; height: 100%; background: \${gradient};
        transition: width 0.3s ease; border-radius: 7px;
    \`;
    bossHealthBar.appendChild(bossHealthFill);

    bossHealthLabel = document.createElement('div');
    bossHealthLabel.style.cssText = \`
        position: fixed; top: 4px; left: 50%; transform: translateX(-50%);
        color: #cc88ff; font-family: monospace; font-size: 11px;
        text-transform: uppercase; letter-spacing: 2px; z-index: 101;
        text-shadow: 0 0 8px \${borderColor};
    \`;
    document.body.appendChild(bossHealthLabel);
    document.body.appendChild(bossHealthBar);
}

function hideBossHealthBar(): void {
    if (bossHealthBar) bossHealthBar.style.display = 'none';
    if (bossHealthLabel) bossHealthLabel.style.display = 'none';
    activeBossKind = null;
}

export function updateBossHealthBar(squids: NebulaKraken[], pitcher?: StarEaterBoss | ZephyrBoss | null): void {
    const activeSquid = squids.find(s => !s.isDestroyed);

    // Check if the boss is Zephyr
    const isZephyr = pitcher && 'windRings' in pitcher;
    const activePitcher = pitcher?.isActive && pitcher.phase !== 'defeated' ? pitcher : null;

    if (activePitcher) {
        if (isZephyr && activeBossKind !== 'zephyr') {
            bossHealthBar = null;
            bossHealthFill = null;
            bossHealthLabel = null;
            activeBossKind = 'zephyr';
        } else if (!isZephyr && activeBossKind !== 'pitcher') {
            bossHealthBar = null;
            bossHealthFill = null;
            bossHealthLabel = null;
            activeBossKind = 'pitcher';
        }
        if (isZephyr) {
            ensureBossHealthBar('#00ffff', 'linear-gradient(90deg, #0066aa, #00ffff, #aaffff)');
        } else {
            ensureBossHealthBar('#ff0044', 'linear-gradient(90deg, #660022, #ff0044, #ff66aa)');
        }

        bossHealthBar!.style.display = 'block';
        if (bossHealthLabel) bossHealthLabel.style.display = 'block';

        const ratio = activePitcher.getHealthRatio();
        if (bossHealthFill) {
            bossHealthFill.style.width = \`\${Math.max(0, ratio * 100)}%\`;
        }

        const rageTag = activePitcher.isRaging() ? ' [RAGE]' : '';
        if (bossHealthLabel) {
            const displayName = isZephyr ? ZEPHYR_NAME : PITCHER_NAME;
            bossHealthLabel.textContent =
                \`⚠ \${displayName} — \${activePitcher.getPhaseName()}\${rageTag} ⚠\`;
        }
        return;
    }

    if (!activeSquid) {
        hideBossHealthBar();
        return;
    }

    if (activeBossKind !== 'kraken') {
        bossHealthBar = null;
        bossHealthFill = null;
        bossHealthLabel = null;
        activeBossKind = 'kraken';
    }
    ensureBossHealthBar('#9900ff', 'linear-gradient(90deg, #8A2BE2, #ff00ff, #9400D3)');

    bossHealthBar!.style.display = 'block';
    if (bossHealthLabel) bossHealthLabel.style.display = 'block';

    const ratio = activeSquid.getHealthRatio();
    if (bossHealthFill) {
        bossHealthFill.style.width = \`\${Math.max(0, ratio * 100)}%\`;
    }

    if (bossHealthLabel) {
        const phase = activeSquid.getPhase();
        const personality = activeSquid.getPersonality();
        const phaseNames = ['', 'VOID SWEEP', 'INK PROTOCOL', 'FRENZY'];
        bossHealthLabel.textContent =
            \`⚠ \${KRAKEN_NAME} — \${phaseNames[phase]} [\${personality.toUpperCase()}] ⚠\`;
    }
}
`;
fs.writeFileSync('src/main/boss_health_ui.ts', huiCode);

// 6. loop_combat/boss.ts
let cb = fs.readFileSync('src/main/loop_combat/boss.ts', 'utf8');
if(!cb.includes('bossResult.pullForceY')) {
    cb = cb.replace(`        if (boss && bossPos) {
            const pullDir = bossPos.y - playerPos.y;
            playerState.currentSpeedY += pullDir * bossResult.pullForce * delta * 0.1;

            if (bossResult.isSnapping) {`, `        if (boss && bossPos) {
            const pullDir = bossPos.y - playerPos.y;
            playerState.currentSpeedY += pullDir * bossResult.pullForce * delta * 0.1;

            // Add vertical pull force from Zephyr boss
            if (bossResult.pullForceY) {
                 playerState.currentSpeedY += bossResult.pullForceY * delta;
            }

            if (bossResult.isSnapping) {`);
    fs.writeFileSync('src/main/loop_combat/boss.ts', cb);
}

// 7. level_config.ts
let lc = fs.readFileSync('src/level_config.ts', 'utf8');
if(lc.includes("description: \"Survive the rusty gauntlet\"")) {
   lc = lc.replace(`        objective: {
            type: 'survive',
            target: 1,
            description: "Survive the rusty gauntlet"
        },`, `        objective: {
            type: 'boss',
            target: 1,
            description: "Defeat The Zephyr"
        },`);
   fs.writeFileSync('src/level_config.ts', lc);
}
