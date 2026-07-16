import * as THREE from 'three';
import type { SporeCloud } from './geological/spore_gravity';

/** Top-level behavioral states from plan.md */
export enum VoidRootBallState {
    DRIFT = 'DRIFT',
    ANCHOR = 'ANCHOR',
    WITHERED = 'WITHERED'
}

/** True while a void root vine is latched on the player. */
export function isVoidRootTethered(group: THREE.Group): boolean {
    return group.userData.harpoonPhase === HarpoonPhase.TETHERED;
}

export enum HarpoonPhase {
    IDLE = 'IDLE',
    TELEGRAPH = 'TELEGRAPH',
    FLYING = 'FLYING',
    TETHERED = 'TETHERED',
    RECOVER = 'RECOVER'
}

export interface RootBallInteraction {
    /** Pull force toward the root ball (world units / frame, pre-scaled by delta). */
    force: THREE.Vector3;
    isTethered: boolean;
    rotationLocked: boolean;
    /** Non-zero when the sever window expires and the player is yanked into impact. */
    impactDamage: number;
    bleedDamagePerSec: number;
    hitPoint: THREE.Vector3 | null;
}

export interface VoidRootBallUpdateContext {
    scene: THREE.Scene;
    projectiles?: Array<{ active: boolean; mesh: THREE.Object3D; deactivate(): void }>;
    sporeClouds?: SporeCloud[];
    /** True when the player is hidden inside Nebula Jelly-Moss (harpoon cannot target). */
    playerStealthed?: boolean;
}

export interface VoidRootBallConfig {
    size?: number;
}

// --- Tunables (plan.md combat section) ---
const ANCHOR_RADIUS = 40;
const DETECTION_RADIUS = 20;
const LOS_CHECK_INTERVAL = 1.5;
const TELEGRAPH_DURATION = 0.5;
const HARPOON_SPEED = 25;
const HARPOON_HITBOX_RADIUS = 0.3;
const VINE_HP = 30;
const SEVER_WINDOW = 4;
const PULL_STRENGTH = 10; // m/s²
const IMPACT_DAMAGE = 50;
const BLEED_DPS = 5;
const BLEED_DURATION = 10;
const ANCHOR_MAX_DURATION = 30;
const DRIFT_RPM = 0.3;
const MAX_CRYSTAL_FLOWERS = 3;
const FLOWER_GROW_INTERVAL = 10;
const FLOWER_ATTRACT_RADIUS = 25;
const FLOWER_ATTRACT_FORCE = 4;

const _tmpVec = new THREE.Vector3();
const _tmpVec2 = new THREE.Vector3();

function createCrystalFlower(size: number): THREE.Mesh {
    const stemGeo = new THREE.CylinderGeometry(size * 0.04, size * 0.06, size * 0.5, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2e1a3a, roughness: 0.9 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = size * 0.25;

    const petalGeo = new THREE.OctahedronGeometry(size * 0.18, 0);
    const petalMat = new THREE.MeshStandardMaterial({
        color: 0xaa66ff,
        emissive: 0x6622cc,
        emissiveIntensity: 1.2,
        roughness: 0.3,
        metalness: 0.4
    });
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.y = size * 0.55;

    const flower = new THREE.Group();
    flower.add(stem);
    flower.add(petal);
    const wrapper = new THREE.Group();
    wrapper.add(flower);

    // Return a mesh-like group stored as mesh via Object3D — use Group cast for flowers array
    const anchor = new THREE.Mesh(new THREE.SphereGeometry(0.01), new THREE.MeshBasicMaterial({ visible: false }));
    anchor.add(wrapper);
    anchor.userData.isCrystalFlower = true;
    anchor.userData.pulsePhase = Math.random() * Math.PI * 2;
    return anchor;
}

function createVineLine(): THREE.Line {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mat = new THREE.LineBasicMaterial({
        color: 0xcc44ff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    return new THREE.Line(geo, mat);
}

function createFlyingHarpoon(size: number): THREE.Mesh {
    const geo = new THREE.ConeGeometry(size * 0.12, size * 0.5, 6);
    geo.rotateZ(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xff66ff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.hitboxRadius = HARPOON_HITBOX_RADIUS;
    return mesh;
}

function hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    // Lightweight LOS: unobstructed in the flora tunnel — no raycast infrastructure yet.
    const dy = Math.abs(from.y - to.y);
    const dz = Math.abs(from.z - to.z);
    return dy < 18 && dz < 12;
}

function darkenGroup(group: THREE.Object3D): void {
    group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat.emissive) {
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0;
            }
            if (mat.color) {
                mat.color.multiplyScalar(0.35);
            }
        }
    });
}

export function createVoidRootBall(config: VoidRootBallConfig = {}): THREE.Group {
    const size = config.size ?? 2 + Math.random() * 2;
    const group = new THREE.Group();

    const rootMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1.0 });
    const rootMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
        const geo = new THREE.TorusKnotGeometry(size * 0.6, size * 0.1, 48, 6, 2, 3);
        const mesh = new THREE.Mesh(geo, rootMat);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        group.add(mesh);
        rootMeshes.push(mesh);
    }

    const coreGeo = new THREE.IcosahedronGeometry(size * 0.4, 0);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x8800ff,
        emissiveIntensity: 2.0,
        roughness: 0.2
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    const telegraphGeo = new THREE.SphereGeometry(size * 0.15, 8, 8);
    const telegraphMat = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
    });
    const telegraphTip = new THREE.Mesh(telegraphGeo, telegraphMat);
    telegraphTip.position.set(0, 0, size * 0.8);
    group.add(telegraphTip);

    group.userData = {
        type: 'voidRootBall',
        speciesId: 'voidRootBall',
        size,
        state: VoidRootBallState.DRIFT,
        harpoonPhase: HarpoonPhase.IDLE,
        stateTimer: 0,
        anchorTimer: 0,
        losCheckTimer: LOS_CHECK_INTERVAL,
        hasLineOfSight: false,
        anchorRadius: ANCHOR_RADIUS,
        detectionRadius: DETECTION_RADIUS,
        coreMesh: core,
        rootMeshes,
        telegraphTip,
        flowers: [] as THREE.Mesh[],
        flowerGrowTimer: FLOWER_GROW_INTERVAL,
        flowersHarvested: 0,
        flyingHarpoon: null as THREE.Mesh | null,
        harpoonVelocity: new THREE.Vector3(),
        vineLine: null as THREE.Line | null,
        vineHp: VINE_HP,
        severTimer: 0,
        recoverTimer: 0,
        bleedTimer: 0,
        driftAngle: Math.random() * Math.PI * 2,
        isPermanentObstacle: false
    };

    return group;
}

function spawnFlower(group: THREE.Group, data: Record<string, unknown>): void {
    const size = data.size as number;
    const flowers = data.flowers as THREE.Mesh[];
    if (flowers.length >= MAX_CRYSTAL_FLOWERS) return;

    const flower = createCrystalFlower(size);
    const angle = Math.random() * Math.PI * 2;
    const dist = size * (1.2 + Math.random() * 0.8);
    flower.position.set(Math.cos(angle) * dist, (Math.random() - 0.5) * size * 0.5, Math.sin(angle) * dist);
    group.add(flower);
    flowers.push(flower);
}

function launchHarpoon(group: THREE.Group, data: Record<string, unknown>, scene: THREE.Scene, target: THREE.Vector3): void {
    const size = data.size as number;
    const harpoon = createFlyingHarpoon(size);
    const worldPos = new THREE.Vector3();
    group.getWorldPosition(worldPos);
    harpoon.position.copy(worldPos);
    const dir = _tmpVec.subVectors(target, worldPos).normalize();
    (data.harpoonVelocity as THREE.Vector3).copy(dir).multiplyScalar(HARPOON_SPEED);
    harpoon.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    scene.add(harpoon);
    data.flyingHarpoon = harpoon;
    data.harpoonPhase = HarpoonPhase.FLYING;
    data.stateTimer = 0;
}

function retractHarpoon(data: Record<string, unknown>, scene: THREE.Scene): void {
    const flying = data.flyingHarpoon as THREE.Mesh | null;
    if (flying) {
        scene.remove(flying);
        flying.geometry.dispose();
        (flying.material as THREE.Material).dispose();
        data.flyingHarpoon = null;
    }
    const vine = data.vineLine as THREE.Line | null;
    if (vine) {
        scene.remove(vine);
        vine.geometry.dispose();
        (vine.material as THREE.Material).dispose();
        data.vineLine = null;
    }
    data.vineHp = VINE_HP;
    data.severTimer = 0;
}

function enterWithered(group: THREE.Group, data: Record<string, unknown>, scene: THREE.Scene): void {
    data.state = VoidRootBallState.WITHERED;
    data.harpoonPhase = HarpoonPhase.IDLE;
    data.isPermanentObstacle = true;
    retractHarpoon(data, scene);

    const telegraph = data.telegraphTip as THREE.Mesh;
    if (telegraph) telegraph.visible = false;

    darkenGroup(group);
    for (const root of data.rootMeshes as THREE.Mesh[]) {
        root.scale.multiplyScalar(1.15);
        root.userData.isPermanentObstacle = true;
    }
}

function updateCrystalFlowers(
    group: THREE.Group,
    data: Record<string, unknown>,
    delta: number,
    timeVal: number,
    sporeClouds?: SporeCloud[]
): void {
    if (data.state === VoidRootBallState.WITHERED) return;

    data.flowerGrowTimer = (data.flowerGrowTimer as number) - delta;
    if ((data.flowerGrowTimer as number) <= 0 && (data.flowers as THREE.Mesh[]).length < MAX_CRYSTAL_FLOWERS) {
        spawnFlower(group, data);
        data.flowerGrowTimer = FLOWER_GROW_INTERVAL;
    }

    const flowers = data.flowers as THREE.Mesh[];
    for (const flower of flowers) {
        flower.userData.pulsePhase = (flower.userData.pulsePhase as number) + delta * 3;
        const pulse = 0.7 + Math.sin(flower.userData.pulsePhase as number) * 0.3;
        flower.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                if (mat.emissiveIntensity !== undefined) {
                    mat.emissiveIntensity = 1.2 * pulse;
                }
            }
        });

        if (!sporeClouds) continue;
        const flowerWorld = new THREE.Vector3();
        flower.getWorldPosition(flowerWorld);

        for (const cloud of sporeClouds) {
            if (!cloud.active) continue;
            const dist = cloud.position.distanceTo(flowerWorld);
            if (dist < FLOWER_ATTRACT_RADIUS) {
                const pull = _tmpVec2.subVectors(flowerWorld, cloud.position);
                const strength = FLOWER_ATTRACT_FORCE * (1 - dist / FLOWER_ATTRACT_RADIUS) * delta;
                cloud.position.add(pull.normalize().multiplyScalar(strength));
            }
        }
    }
}

function updateDrift(group: THREE.Group, data: Record<string, unknown>, delta: number, playerPos: THREE.Vector3): void {
    const driftRadPerSec = (DRIFT_RPM / 60) * Math.PI * 2;
    data.driftAngle = (data.driftAngle as number) + driftRadPerSec * delta;
    group.rotation.y = data.driftAngle as number;
    group.rotation.x = Math.sin((data.driftAngle as number) * 0.5) * 0.15;

    if (group.position.distanceTo(playerPos) <= (data.anchorRadius as number)) {
        data.state = VoidRootBallState.ANCHOR;
        data.anchorTimer = 0;
        data.harpoonPhase = HarpoonPhase.IDLE;
        data.losCheckTimer = 0;
    }
}

function updateAnchor(
    group: THREE.Group,
    data: Record<string, unknown>,
    delta: number,
    timeVal: number,
    playerPos: THREE.Vector3,
    scene: THREE.Scene,
    ctx: VoidRootBallUpdateContext,
    result: RootBallInteraction
): void {
    data.anchorTimer = (data.anchorTimer as number) + delta;

    const flowers = data.flowers as THREE.Mesh[];
    const allFlowersGone = flowers.length === 0 && (data.flowersHarvested as number) >= MAX_CRYSTAL_FLOWERS;
    if ((data.anchorTimer as number) >= ANCHOR_MAX_DURATION || allFlowersGone) {
        enterWithered(group, data, scene);
        return;
    }

    group.lookAt(playerPos);

    const dist = group.position.distanceTo(playerPos);
    const stealthed = ctx.playerStealthed === true;

    data.losCheckTimer = (data.losCheckTimer as number) - delta;
    if ((data.losCheckTimer as number) <= 0) {
        data.losCheckTimer = LOS_CHECK_INTERVAL;
        data.hasLineOfSight = !stealthed && dist <= (data.detectionRadius as number)
            && hasLineOfSight(group.position, playerPos);
    }

    const telegraph = data.telegraphTip as THREE.Mesh;
    const telegraphMat = telegraph.material as THREE.MeshBasicMaterial;
    const coreMat = (data.coreMesh as THREE.Mesh).material as THREE.MeshStandardMaterial;

    switch (data.harpoonPhase as HarpoonPhase) {
        case HarpoonPhase.IDLE:
            telegraphMat.opacity = 0;
            if (data.hasLineOfSight) {
                data.harpoonPhase = HarpoonPhase.TELEGRAPH;
                data.stateTimer = TELEGRAPH_DURATION;
            }
            break;

        case HarpoonPhase.TELEGRAPH:
            telegraphMat.opacity = 0.4 + Math.sin(timeVal * 20) * 0.35;
            coreMat.emissive.setHex(timeVal % 0.2 < 0.1 ? 0xff2244 : 0x8800ff);
            data.stateTimer = (data.stateTimer as number) - delta;
            if ((data.stateTimer as number) <= 0) {
                telegraphMat.opacity = 0;
                launchHarpoon(group, data, scene, playerPos);
            }
            break;

        case HarpoonPhase.FLYING: {
            const harpoon = data.flyingHarpoon as THREE.Mesh;
            const vel = data.harpoonVelocity as THREE.Vector3;
            harpoon.position.addScaledVector(vel, delta);

            if (ctx.projectiles) {
                for (const proj of ctx.projectiles) {
                    if (!proj.active) continue;
                    if (harpoon.position.distanceTo(proj.mesh.position) < HARPOON_HITBOX_RADIUS) {
                        proj.deactivate();
                        retractHarpoon(data, scene);
                        data.harpoonPhase = HarpoonPhase.RECOVER;
                        data.recoverTimer = 2;
                        return;
                    }
                }
            }

            const hitPlayer = harpoon.position.distanceTo(playerPos) < 1.2;
            const maxRange = (data.detectionRadius as number) * 2;
            const outOfRange = group.position.distanceTo(harpoon.position) > maxRange;

            if (hitPlayer) {
                data.harpoonPhase = HarpoonPhase.TETHERED;
                data.severTimer = SEVER_WINDOW;
                data.vineHp = VINE_HP;
                const vine = createVineLine();
                scene.add(vine);
                data.vineLine = vine;
                result.isTethered = true;
                result.rotationLocked = true;
            } else if (outOfRange) {
                retractHarpoon(data, scene);
                data.harpoonPhase = HarpoonPhase.RECOVER;
                data.recoverTimer = 1.5;
            }
            break;
        }

        case HarpoonPhase.TETHERED: {
            result.isTethered = true;
            result.rotationLocked = true;

            const vine = data.vineLine as THREE.Line;
            if (vine) {
                const pos = vine.geometry.attributes.position;
                pos.setXYZ(0, group.position.x, group.position.y, group.position.z);
                pos.setXYZ(1, playerPos.x, playerPos.y, playerPos.z);
                pos.needsUpdate = true;
            }

            const pullDir = _tmpVec.subVectors(group.position, playerPos).normalize();
            result.force.add(pullDir.multiplyScalar(PULL_STRENGTH * delta));

            if (ctx.projectiles) {
                for (const proj of ctx.projectiles) {
                    if (!proj.active) continue;
                    const mid = _tmpVec2.addVectors(group.position, playerPos).multiplyScalar(0.5);
                    if (proj.mesh.position.distanceTo(mid) < 2.5
                        || proj.mesh.position.distanceTo(playerPos) < 1.5) {
                        proj.deactivate();
                        data.vineHp = (data.vineHp as number) - 10;
                        if ((data.vineHp as number) <= 0) {
                            retractHarpoon(data, scene);
                            data.harpoonPhase = HarpoonPhase.RECOVER;
                            data.recoverTimer = 2.5;
                            result.isTethered = false;
                            result.rotationLocked = false;
                            return;
                        }
                    }
                }
            }

            data.severTimer = (data.severTimer as number) - delta;
            if ((data.severTimer as number) <= 0) {
                result.impactDamage = IMPACT_DAMAGE;
                result.bleedDamagePerSec = BLEED_DPS;
                data.bleedTimer = BLEED_DURATION;
                retractHarpoon(data, scene);
                data.harpoonPhase = HarpoonPhase.RECOVER;
                data.recoverTimer = 3;
                result.isTethered = false;
                result.rotationLocked = false;
            }
            break;
        }

        case HarpoonPhase.RECOVER:
            data.recoverTimer = (data.recoverTimer as number) - delta;
            coreMat.emissive.setHex(0x8800ff);
            if ((data.recoverTimer as number) <= 0) {
                data.harpoonPhase = HarpoonPhase.IDLE;
            }
            break;
    }

    if (dist > (data.anchorRadius as number) * 1.2) {
        data.state = VoidRootBallState.DRIFT;
        retractHarpoon(data, scene);
        data.harpoonPhase = HarpoonPhase.IDLE;
    }
}

export function updateVoidRootBall(
    group: THREE.Group,
    delta: number,
    timeVal: number,
    player: THREE.Object3D,
    ctx: VoidRootBallUpdateContext
): RootBallInteraction {
    const result: RootBallInteraction = {
        force: new THREE.Vector3(),
        isTethered: false,
        rotationLocked: false,
        impactDamage: 0,
        bleedDamagePerSec: 0,
        hitPoint: null
    };

    const data = group.userData;
    const playerPos = player.position;

    updateCrystalFlowers(group, data, delta, timeVal, ctx.sporeClouds);

    if (data.state === VoidRootBallState.WITHERED) {
        return result;
    }

    if (data.state === VoidRootBallState.DRIFT) {
        updateDrift(group, data, delta, playerPos);
    } else if (data.state === VoidRootBallState.ANCHOR) {
        updateAnchor(group, data, delta, timeVal, playerPos, ctx.scene, ctx, result);
    }

    if (result.isTethered) {
        result.hitPoint = playerPos.clone();
    }

    return result;
}

/** Harvest a crystal flower (scan/collect interaction). */
export function harvestVoidRootFlower(group: THREE.Group, flower: THREE.Mesh): boolean {
    const data = group.userData;
    if (data.state === VoidRootBallState.WITHERED) return false;
    const flowers = data.flowers as THREE.Mesh[];
    const idx = flowers.indexOf(flower);
    if (idx < 0) return false;
    group.remove(flower);
    flowers.splice(idx, 1);
    data.flowersHarvested = (data.flowersHarvested as number) + 1;
    return true;
}

export function disposeVoidRootBall(group: THREE.Group, scene: THREE.Scene): void {
    const data = group.userData;
    retractHarpoon(data, scene);
    scene.remove(group);
    group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.geometry?.dispose();
            const mat = mesh.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat?.dispose();
        }
    });
}
