/**
 * Grav-Lenses — gravitational slingshot puzzle nodes (plan §III).
 *
 * Inverse-square pull, stable ~15 m orbit ring, graded slingshot exits,
 * crush zone on failed approaches, Cryo detune, and shatter → micro black hole.
 * Force logic is CPU-side (WebGL2-safe).
 */

import * as THREE from 'three';
import type { SlingQuality } from './sling_combo';

// --- Tunables (plan-aligned) ---
const CORE_RADIUS = 0.5;
const ORBIT_RADIUS = 15;
const ORBIT_TARGET_SPEED = 12;
const INFLUENCE_RADIUS = 28;
const CRUSH_RADIUS = 5;
const FORCE_MASS = 50;
const FORCE_SOFTENING = 2.5;
const MAX_PULL_PER_SEC = 45;
const CRUSH_DPS = 20;
const SHATTER_DAMAGE_THRESHOLD = 150;
const SHATTER_DAMAGE_WINDOW = 3;
const DETUNE_DURATION = 10;
const PERFECT_ANGLE_DEG = 75;
const PARTIAL_ANGLE_DEG = 45;
const PERFECT_BOOST_MULT = 3;
const PARTIAL_BOOST_MULT = 1.5;
const BOOST_DURATION_PERFECT = 8;
const BOOST_DURATION_PARTIAL = 5;
const CHAIN_TIMEOUT = 6;
const MICRO_BH_DURATION = 3;
const MICRO_BH_PULL_RADIUS = 2;

export type SlingshotGrade = 'perfect' | 'partial' | 'failed' | 'none';

export interface GravLensPlacement {
    offsetX: number;
    y: number;
    z?: number;
    mass?: number;
}

export interface GravLensCorridorConfig {
    startX: number;
    lenses: GravLensPlacement[];
}

export interface GravLensUpdateResult {
    forceX: number;
    forceY: number;
    inCrushZone: boolean;
    slingshotExits: {
        // 'none' and 'failed' exits are filtered out by _buildSlingshotExit.
        grade: Exclude<SlingshotGrade, 'none' | 'failed'>;
        position: THREE.Vector3;
        chain: number;
        boostMult: number;
        boostDuration: number;
    }[];
    failedExits: THREE.Vector3[];
}

export interface GravLensUpdateCallbacks {
    onGrade?: (grade: SlingshotGrade, position: THREE.Vector3, chain: number) => void;
    onCrushDamage?: (amount: number, position: THREE.Vector3) => void;
    onDetune?: (position: THREE.Vector3) => void;
    onShatter?: (position: THREE.Vector3) => void;
    onApproachAngle?: (angleDeg: number, inRange: boolean) => void;
}

export interface GravLensPlayerState {
    position: THREE.Vector3;
    velocityX: number;
    velocityY: number;
    autoScrollSpeed: number;
    currentSpeedY: number;
    invincible?: boolean;
    inSafeHarbor?: boolean;
}

interface DamageWindow {
    total: number;
    timer: number;
}

interface MicroBlackHole {
    group: THREE.Group;
    timer: number;
    position: THREE.Vector3;
}

interface GravLensInstance {
    group: THREE.Group;
    mass: number;
    detuneTimer: number;
    wasInField: boolean;
    peakEntryAngle: number;
    crushAccum: number;
    damageWindow: DamageWindow;
    microBh: MicroBlackHole | null;
    chainEligible: boolean;
}

function createLensMesh(): THREE.Group {
    const group = new THREE.Group();

    const coreGeo = new THREE.SphereGeometry(CORE_RADIUS, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x110022 });
    group.add(new THREE.Mesh(coreGeo, coreMat));

    const haloGeo = new THREE.SphereGeometry(CORE_RADIUS * 2.2, 12, 12);
    const haloMat = new THREE.MeshBasicMaterial({
        color: 0xaa66ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    group.add(new THREE.Mesh(haloGeo, haloMat));

    const orbitGeo = new THREE.RingGeometry(ORBIT_RADIUS - 0.15, ORBIT_RADIUS + 0.15, 48);
    const orbitMat = new THREE.MeshBasicMaterial({
        color: 0x44ccff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
    orbitRing.rotation.x = Math.PI * 0.5;
    group.add(orbitRing);

    const crushGeo = new THREE.RingGeometry(CRUSH_RADIUS - 0.1, CRUSH_RADIUS + 0.1, 32);
    const crushMat = new THREE.MeshBasicMaterial({
        color: 0xff2244,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const crushRing = new THREE.Mesh(crushGeo, crushMat);
    crushRing.rotation.x = Math.PI * 0.5;
    crushRing.userData.isCrushRing = true;
    group.add(crushRing);

    group.userData.type = 'gravLens';
    group.userData.speciesId = 'gravLens';
    return group;
}

function computeEntryAngleDeg(
    playerPos: THREE.Vector3,
    lensPos: THREE.Vector3,
    velX: number,
    velY: number
): number {
    const speed = Math.hypot(velX, velY);
    if (speed < 0.4) return 0;

    const dx = lensPos.x - playerPos.x;
    const dy = lensPos.y - playerPos.y;
    const radialLen = Math.hypot(dx, dy);
    if (radialLen < 0.01) return 0;

    const dot = Math.abs((velX / speed) * (dx / radialLen) + (velY / speed) * (dy / radialLen));
    return Math.acos(THREE.MathUtils.clamp(dot, 0, 1)) * (180 / Math.PI);
}

function gradeFromAngle(angleDeg: number): SlingshotGrade {
    if (angleDeg >= PERFECT_ANGLE_DEG) return 'perfect';
    if (angleDeg >= PARTIAL_ANGLE_DEG) return 'partial';
    return 'failed';
}

function slingQualityFromGrade(grade: SlingshotGrade): SlingQuality {
    if (grade === 'perfect') return 'perfect';
    if (grade === 'partial') return 'good';
    return 'messy';
}

export class GravLensManager {
    private readonly scene: THREE.Scene;
    private lenses: GravLensInstance[] = [];
    private chainCount = 0;
    private chainTimer = 0;
    private lastHudAngle = 0;
    private nearestInfluence = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    getLenses(): THREE.Group[] {
        return this.lenses.map(l => l.group);
    }

    getScannables(): THREE.Object3D[] {
        return this.lenses.map(l => l.group);
    }

    clear(): void {
        for (const lens of this.lenses) {
            this.scene.remove(lens.group);
            lens.group.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    const mat = child.material;
                    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                    else mat.dispose();
                }
            });
            if (lens.microBh) {
                this.scene.remove(lens.microBh.group);
            }
        }
        this.lenses = [];
        this.chainCount = 0;
        this.chainTimer = 0;
    }

    spawnCorridor(config: GravLensCorridorConfig): void {
        for (const placement of config.lenses) {
            const group = createLensMesh();
            group.position.set(
                config.startX + placement.offsetX,
                placement.y,
                placement.z ?? -6
            );
            this.scene.add(group);
            this.lenses.push({
                group,
                mass: placement.mass ?? FORCE_MASS,
                detuneTimer: 0,
                wasInField: false,
                peakEntryAngle: 0,
                crushAccum: 0,
                damageWindow: { total: 0, timer: 0 },
                microBh: null,
                chainEligible: true
            });
        }
    }

    handleProjectileHits(
        projectiles: { active: boolean; mesh: THREE.Mesh }[],
        activeUpgrade: string,
        onDetune?: (position: THREE.Vector3) => void
    ): void {
        const isCryo = activeUpgrade === 'cryo';
        for (const lens of this.lenses) {
            if (lens.detuneTimer > 0 && !isCryo) continue;
            const pos = lens.group.position;
            for (const proj of projectiles) {
                if (!proj.active) continue;
                const dist = pos.distanceTo(proj.mesh.position);
                if (dist > ORBIT_RADIUS) continue;

                lens.damageWindow.total += 25;
                lens.damageWindow.timer = SHATTER_DAMAGE_WINDOW;

                if (isCryo) {
                    lens.detuneTimer = DETUNE_DURATION;
                    onDetune?.(pos.clone());
                }

                if (lens.damageWindow.total >= SHATTER_DAMAGE_THRESHOLD) {
                    this._spawnMicroBlackHole(lens);
                    lens.damageWindow.total = 0;
                    lens.damageWindow.timer = 0;
                }
            }
        }
    }

    update(
        delta: number,
        player: GravLensPlayerState,
        callbacks: GravLensUpdateCallbacks = {}
    ): GravLensUpdateResult {
        let totalFx = 0;
        let totalFy = 0;
        let inCrushZone = false;
        let bestAngle = 0;
        this.nearestInfluence = false;
        const slingshotExits: GravLensUpdateResult['slingshotExits'] = [];
        const failedExits: THREE.Vector3[] = [];

        if (this.chainCount > 0) {
            this.chainTimer += delta;
            if (this.chainTimer >= CHAIN_TIMEOUT) {
                this.chainCount = 0;
                this.chainTimer = 0;
            }
        }

        const velX = player.velocityX || player.autoScrollSpeed;
        const velY = player.velocityY || player.currentSpeedY;

        for (const lens of this.lenses) {
            if (lens.detuneTimer > 0) {
                lens.detuneTimer = Math.max(0, lens.detuneTimer - delta);
            }

            if (lens.damageWindow.timer > 0) {
                lens.damageWindow.timer = Math.max(0, lens.damageWindow.timer - delta);
                if (lens.damageWindow.timer <= 0) lens.damageWindow.total = 0;
            }

            this._animateLens(lens, delta);

            if (lens.microBh) {
                this._updateMicroBlackHole(lens, delta, player, callbacks);
            }

            const pos = lens.group.position;
            const dist = pos.distanceTo(player.position);
            const inField = dist < INFLUENCE_RADIUS && lens.detuneTimer <= 0;

            if (inField) {
                this.nearestInfluence = true;
                const entryAngle = computeEntryAngleDeg(player.position, pos, velX, velY);
                lens.peakEntryAngle = Math.max(lens.peakEntryAngle, entryAngle);
                if (entryAngle > bestAngle) bestAngle = entryAngle;

                const soft2 = FORCE_SOFTENING * FORCE_SOFTENING;
                const rawMag = (lens.mass * FORCE_MASS) / (dist * dist + soft2);
                const edgeFade = 1 - dist / INFLUENCE_RADIUS;
                const forceMag = Math.min(rawMag, MAX_PULL_PER_SEC) * edgeFade;

                const dirX = (pos.x - player.position.x) / Math.max(dist, 0.01);
                const dirY = (pos.y - player.position.y) / Math.max(dist, 0.01);
                totalFx += dirX * forceMag * delta;
                totalFy += dirY * forceMag * delta;

                // Stable orbit assist near 15 m
                if (dist > ORBIT_RADIUS * 0.85 && dist < ORBIT_RADIUS * 1.15) {
                    const tangentX = -dirY;
                    const tangentY = dirX;
                    const orbitAssist = ORBIT_TARGET_SPEED * 0.08 * delta;
                    totalFx += tangentX * orbitAssist;
                    totalFy += tangentY * orbitAssist;
                }

                const grade = gradeFromAngle(lens.peakEntryAngle);
                if (dist < CRUSH_RADIUS && grade === 'failed' && !player.invincible && !player.inSafeHarbor) {
                    inCrushZone = true;
                    lens.crushAccum += CRUSH_DPS * delta;
                    if (lens.crushAccum >= 1) {
                        const damage = Math.floor(lens.crushAccum);
                        lens.crushAccum -= damage;
                        callbacks.onCrushDamage?.(damage, player.position.clone());
                    }
                } else {
                    lens.crushAccum = 0;
                }
            } else if (lens.wasInField) {
                const grade = gradeFromAngle(lens.peakEntryAngle);
                if (grade === 'failed') {
                    failedExits.push(lens.group.position.clone());
                    this.chainCount = 0;
                } else {
                    const exit = this._buildSlingshotExit(lens, grade);
                    if (exit) slingshotExits.push(exit);
                }
                lens.peakEntryAngle = 0;
                lens.crushAccum = 0;
            }

            lens.wasInField = inField;
        }

        this.lastHudAngle = bestAngle;
        callbacks.onApproachAngle?.(bestAngle, this.nearestInfluence);

        return { forceX: totalFx, forceY: totalFy, inCrushZone, slingshotExits, failedExits };
    }

    getChainCount(): number {
        return this.chainCount;
    }

    getLastApproachAngle(): number {
        return this.lastHudAngle;
    }

    isInInfluence(): boolean {
        return this.nearestInfluence;
    }

    static slingQualityFromGrade(grade: SlingshotGrade): SlingQuality {
        return slingQualityFromGrade(grade);
    }

    private _buildSlingshotExit(
        lens: GravLensInstance,
        grade: SlingshotGrade
    ): GravLensUpdateResult['slingshotExits'][number] | null {
        if (grade === 'none' || grade === 'failed') return null;

        this.chainCount++;
        this.chainTimer = 0;

        const mult = grade === 'perfect' ? PERFECT_BOOST_MULT : PARTIAL_BOOST_MULT;
        const chainBonus = 1 + Math.min(this.chainCount - 1, 4) * 0.15;

        return {
            grade,
            position: lens.group.position.clone(),
            chain: this.chainCount,
            boostMult: mult * chainBonus,
            boostDuration: grade === 'perfect' ? BOOST_DURATION_PERFECT : BOOST_DURATION_PARTIAL
        };
    }

    private _animateLens(lens: GravLensInstance, delta: number): void {
        const t = performance.now() * 0.001;
        lens.group.rotation.y += delta * 0.35;
        const detuned = lens.detuneTimer > 0;
        lens.group.children.forEach(child => {
            if (!(child instanceof THREE.Mesh)) return;
            if (child.userData.isCrushRing) {
                child.material.opacity = detuned ? 0.05 : 0.2 + Math.sin(t * 4) * 0.08;
            } else if (child.geometry.type === 'RingGeometry' && !child.userData.isCrushRing) {
                (child.material as THREE.MeshBasicMaterial).opacity = detuned ? 0.15 : 0.45 + Math.sin(t * 2) * 0.12;
            }
        });
    }

    private _spawnMicroBlackHole(lens: GravLensInstance): void {
        if (lens.microBh) return;
        const group = new THREE.Group();
        group.position.copy(lens.group.position);

        const core = new THREE.Mesh(
            new THREE.SphereGeometry(MICRO_BH_PULL_RADIUS * 0.4, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        group.add(core);

        const disk = new THREE.Mesh(
            new THREE.RingGeometry(MICRO_BH_PULL_RADIUS * 0.5, MICRO_BH_PULL_RADIUS * 1.8, 24),
            new THREE.MeshBasicMaterial({
                color: 0xff6600,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        disk.rotation.x = -Math.PI * 0.35;
        group.add(disk);

        this.scene.add(group);
        lens.microBh = { group, timer: MICRO_BH_DURATION, position: lens.group.position.clone() };
    }

    private _updateMicroBlackHole(
        lens: GravLensInstance,
        delta: number,
        player: GravLensPlayerState,
        callbacks: GravLensUpdateCallbacks
    ): void {
        const bh = lens.microBh!;
        bh.timer -= delta;
        bh.group.rotation.z += delta * 2.5;

        const dist = bh.position.distanceTo(player.position);
        if (dist < MICRO_BH_PULL_RADIUS * 4 && lens.detuneTimer <= 0) {
            const pull = (8 / Math.max(dist * dist, 0.5)) * delta;
            const dx = (bh.position.x - player.position.x) / Math.max(dist, 0.01);
            const dy = (bh.position.y - player.position.y) / Math.max(dist, 0.01);
            player.currentSpeedY += dy * pull;
            player.autoScrollSpeed = Math.min(player.autoScrollSpeed + dx * pull * 0.3, 26);
        }

        if (bh.timer <= 0) {
            this.scene.remove(bh.group);
            bh.group.traverse(c => {
                if (c instanceof THREE.Mesh) {
                    c.geometry.dispose();
                    const m = c.material;
                    if (Array.isArray(m)) m.forEach(x => x.dispose());
                    else m.dispose();
                }
            });
            lens.microBh = null;
            callbacks.onShatter?.(bh.position.clone());
        }
    }
}
