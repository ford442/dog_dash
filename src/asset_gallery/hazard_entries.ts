/**
 * Gallery entries for hazards, formation enemies and bosses (issue: hazards,
 * enemies & bosses as game assets). Each entry builds the same object the
 * game spawns — through the real factories where they are standalone — and
 * poses it for the gallery state.
 */

import * as THREE from 'three';
import { LEVEL_CONFIG } from '../level_config';
import {
    ASTEROID_KINDS,
    createAsteroidMaterial,
    getAsteroidGeometry,
    type AsteroidKind
} from '../hazard_art/asteroid_kit';
import {
    ENEMY_CHARACTER_IDS,
    ENEMY_CHARACTER_LABELS,
    CHAPTER_ENEMY,
    createEnemyCharacter,
    flashEnemy,
    rollEnemyBodyColor,
    updateEnemyRig,
    getEnemyBodyColor,
    type EnemyCharacterId
} from '../hazard_art/enemy_characters';
import { createMineRobot, createBarnaclePod, createCandyAsteroid } from '../obstacle_system/spawn_pools';
import type { ObstacleSystemHost } from '../obstacle_system/host';
import {
    ZephyrRig,
    ZEPHYR_EYE_DURATION,
    ZEPHYR_EYE_RADIUS,
    ZEPHYR_GALE_DURATION,
    ZEPHYR_SHEAR_DURATION,
    ZEPHYR_SHIELD_RADIUS
} from '../boss_system/zephyr_rig';
import { buildPitcherMinionVisual, posePitcherMinion, PITCHER_MINION_HITBOX_RADIUS } from '../boss_system/pitcher_minion';
import { StarEaterBoss } from '../boss_system/star_eater_boss';
import { NebulaKraken } from '../space_robot_squid';
import { disposeObject } from '../utils';
import { registerGalleryEntries, type GalleryContext, type GalleryEntry } from './registry';

const ASTEROID_LABELS: Record<AsteroidKind, string> = {
    chunk: 'Asteroid — chunk',
    shard: 'Asteroid — shard',
    cratered: 'Asteroid — cratered boulder',
    ore: 'Asteroid — ore-vein rock',
    rubble: 'Asteroid — rubble'
};

/** Minimal obstacle host so the real spawn factories can build into a throwaway scene. */
function stubHost(chapter: number): ObstacleSystemHost {
    const scene = new THREE.Scene();
    return {
        scene,
        obstacles: [],
        patternEnemies: [],
        options: { getCurrentLevel: () => chapter } as unknown as ObstacleSystemHost['options']
    } as unknown as ObstacleSystemHost;
}

function detach(obj: THREE.Object3D): THREE.Object3D {
    obj.removeFromParent();
    return obj;
}

const noopParticles = { emit: () => {} };
const noopDebris = { emit: () => {} };

function asteroidEntry(kind: AsteroidKind): GalleryEntry {
    return {
        id: `asteroid_${kind}`,
        label: ASTEROID_LABELS[kind],
        category: 'hazard',
        note: 'Shared kit geometry; chapter palette on the material.',
        build: (ctx) => {
            const mesh = new THREE.Mesh(getAsteroidGeometry(kind), createAsteroidMaterial(kind, ctx.chapter));
            mesh.rotation.set(0.4, 0.3, 0.2);
            return {
                object: mesh,
                update: (dt) => {
                    mesh.rotation.x += dt * 0.3;
                },
                hitboxes: () => [{ x: 0, y: 0, radius: 1, weak: true }],
                dispose: () => disposeObject(mesh)
            };
        }
    };
}

function enemyEntry(id: EnemyCharacterId): GalleryEntry {
    const chapter = Number(Object.keys(CHAPTER_ENEMY).find((k) => CHAPTER_ENEMY[Number(k)] === id) ?? 1);
    return {
        id: `enemy_${id}`,
        label: ENEMY_CHARACTER_LABELS[id],
        category: 'enemy',
        note: 'Idle loop; telegraph when the player is ahead within 16u.',
        build: (ctx) => {
            const tint = ctx.applyTint ? LEVEL_CONFIG[chapter]?.enemyTintColor : undefined;
            const color = tint !== undefined ? rollEnemyBodyColor(id, tint) : getEnemyBodyColor(id);
            const mesh = createEnemyCharacter(id, color);
            mesh.userData.radius = 1;
            let lastFlash = -1;
            return {
                object: mesh,
                update: (dt, t, c) => {
                    if (c.mode === 'hit' && Math.floor(t / 1.2) !== lastFlash) {
                        lastFlash = Math.floor(t / 1.2);
                        flashEnemy(mesh);
                    }
                    // Telegraph aims at a player slightly above-left.
                    updateEnemyRig(mesh, dt, t, c.mode === 'telegraph' ? 1 : 0, 2);
                },
                hitboxes: () => [{ x: 0, y: 0, radius: 1, weak: true }],
                dispose: () => disposeObject(mesh)
            };
        }
    };
}

const mineRobotEntry: GalleryEntry = {
    id: 'mine_robot',
    label: 'Grumpy Mine Robot (ch4)',
    category: 'hazard',
    note: 'Reference asset. Pupils flare within 12u.',
    build: (ctx) => {
        const mine = detach(createMineRobot(stubHost(ctx.chapter), 0, 0, 0)) as THREE.Mesh;
        const pupils = mine.userData.pupils as THREE.Mesh[];
        return {
            object: mine,
            update: (_dt, _t, c) => {
                const alert = c.mode === 'telegraph' ? 1 : 0;
                for (const pupil of pupils) {
                    (pupil.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + alert * 0.8;
                    pupil.scale.setScalar(1 + alert * 0.3);
                }
            },
            hitboxes: () => [{ x: 0, y: 0, radius: mine.userData.radius, weak: true }],
            dispose: () => disposeObject(mine)
        };
    }
};

const barnacleEntry: GalleryEntry = {
    id: 'barnacle_pod',
    label: 'Barnacle Pod (ch5)',
    category: 'hazard',
    note: 'Audit: still a dodecahedron (follow-up).',
    build: (ctx) => {
        const pod = detach(createBarnaclePod(stubHost(ctx.chapter), 0, 0, 0)) as THREE.Mesh;
        return {
            object: pod,
            hitboxes: () => [{ x: 0, y: 0, radius: pod.userData.radius, weak: true }],
            dispose: () => disposeObject(pod)
        };
    }
};

const candyEntry: GalleryEntry = {
    id: 'candy_asteroid',
    label: 'Candy asteroid',
    category: 'hazard',
    note: 'Material-only candy skin on a sphere (follow-up).',
    build: (ctx) => {
        const candy = detach(createCandyAsteroid(stubHost(ctx.chapter), 0, 0, 0, 1)) as THREE.Mesh;
        return {
            object: candy,
            hitboxes: () => [{ x: 0, y: 0, radius: 1, weak: true }],
            dispose: () => disposeObject(candy)
        };
    }
};

function zephyrPhaseDuration(phase: GalleryContext['bossPhase']): number {
    if (phase === 'phase1') return ZEPHYR_GALE_DURATION;
    if (phase === 'phase2') return ZEPHYR_SHEAR_DURATION;
    if (phase === 'phase3') return ZEPHYR_EYE_DURATION;
    return 6;
}

const zephyrEntry: GalleryEntry = {
    id: 'boss_zephyr',
    label: 'Zephyr — eye of the storm (ch4 boss)',
    category: 'boss',
    span: 2,
    note: 'Eye = weak point (r 4, Eye phase); cloud wreath = shield (r 8).',
    build: () => {
        const rig = new ZephyrRig();
        let lastFlash = -1;
        return {
            object: rig.root,
            update: (dt, t, ctx) => {
                const dur = zephyrPhaseDuration(ctx.bossPhase);
                const phaseTime = t % dur;
                if (ctx.mode === 'hit' && Math.floor(t / 1.2) !== lastFlash) {
                    lastFlash = Math.floor(t / 1.2);
                    rig.hit();
                }
                rig.update(dt, {
                    phase: ctx.bossPhase,
                    phaseTime,
                    weakPointExposed: ctx.bossPhase === 'phase3',
                    pullForceY: ctx.bossPhase === 'phase2' ? Math.sin(t * 3) * 20 : 0,
                    target: { x: -25, y: Math.sin(t * 0.7) * 8 }
                });
            },
            hitboxes: (ctx) => ctx.bossPhase === 'phase3'
                ? [{ x: 0, y: 0, radius: Math.ceil(ZEPHYR_EYE_RADIUS), weak: true }]
                : [{ x: 0, y: 0, radius: ZEPHYR_SHIELD_RADIUS, weak: false }],
            dispose: () => rig.dispose()
        };
    }
};

const pitcherMinionEntry: GalleryEntry = {
    id: 'boss_pitcher_minion',
    label: 'Pitcher minion (ch6 boss add)',
    category: 'boss',
    note: 'Nectar = weak point; whole body inside the r 2.5 hitbox. Rage = red, faster chomp.',
    build: () => {
        const visual = buildPitcherMinionVisual();
        // Shown as in the orbit: mouth pointing left (away from the boss), +Y toward camera.
        const holder = new THREE.Group();
        visual.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(1, 0, 0)
        ));
        holder.add(visual.group);
        let flash = 0;
        let lastFlash = -1;
        return {
            object: holder,
            update: (dt, t, ctx) => {
                if (ctx.mode === 'hit' && Math.floor(t / 1.2) !== lastFlash) {
                    lastFlash = Math.floor(t / 1.2);
                    flash = 1;
                }
                flash = Math.max(0, flash - dt * 5);
                posePitcherMinion(visual, t, flash, ctx.mode === 'telegraph' ? 1 : 0);
            },
            hitboxes: () => [{ x: 0, y: 0, radius: PITCHER_MINION_HITBOX_RADIUS, weak: true }],
            dispose: () => disposeObject(holder)
        };
    }
};

const starEaterEntry: GalleryEntry = {
    id: 'boss_star_eater',
    label: 'Star-Eater Pitcher (ch6 boss)',
    category: 'boss',
    span: 2,
    note: 'Reference asset. Mouth hitbox at +8x (shield r 6, uvula r 2).',
    build: () => {
        const scene = new THREE.Scene();
        const boss = new StarEaterBoss(scene, { spawnX: 0, arenaWidth: 60, health: 300 }, {
            onDefeated: () => {},
            onPlayerHit: () => {},
            getPlayerPosition: () => null,
            spawnDebris: () => {}
        });
        const group = detach(boss.group);
        group.visible = true;
        group.position.set(0, 0, 0);
        return {
            object: group,
            update: (dt) => {
                for (const [i, tooth] of boss.teeth.entries()) tooth.rotation.z += dt * (0.5 + i * 0.1);
            },
            hitboxes: (ctx) => [{ x: 8, y: 0, radius: ctx.bossPhase === 'phase3' ? 2 : 6, weak: ctx.bossPhase === 'phase3' }],
            dispose: () => disposeObject(group)
        };
    }
};

const krakenEntry: GalleryEntry = {
    id: 'boss_kraken',
    label: 'Nebula Kraken (mini-boss)',
    category: 'boss',
    span: 2,
    note: 'Reference asset.',
    build: () => {
        const scene = new THREE.Scene();
        const kraken = new NebulaKraken({
            scene,
            particleSystem: noopParticles as never,
            debrisSystem: noopDebris as never
        }, 0, 0);
        const group = detach(kraken.group);
        return {
            object: group,
            update: (dt) => {
                kraken.update(dt, -30, 0);
                group.position.set(0, 0, 0);
            },
            hitboxes: () => [{ x: 0, y: 0, radius: kraken.getRadius(), weak: true }],
            dispose: () => disposeObject(group)
        };
    }
};

registerGalleryEntries(
    ...ASTEROID_KINDS.map(asteroidEntry),
    mineRobotEntry,
    barnacleEntry,
    candyEntry,
    ...ENEMY_CHARACTER_IDS.map(enemyEntry),
    zephyrEntry,
    pitcherMinionEntry,
    starEaterEntry,
    krakenEntry
);
