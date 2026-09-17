import * as THREE from 'three';
import { game } from './game_runtime';
import { gravityAnchors, sporeClouds } from './environment';
import { CollisionLayer, type SpatialIndex } from './spatial_index';

/**
 * Rebuild the gameplay spatial hash from live world objects.
 * Call once per fixed sim step after motion, before radius queries.
 */
export function rebuildGameplaySpatialHash(): void {
    const index: SpatialIndex = game.spatialIndex;
    index.begin();

    game.obstacleSystem.collectSpatial(index);

    const clouds = game.obstacleSystem.options.sporeClouds ?? sporeClouds;
    for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        if (!c.active) continue;
        index.add(c.position.x, c.position.y, c.position.z, 5.0, CollisionLayer.Spore, i, 'spore');
    }

    game.orbManager.collectSpatial(index);
    game.creatureManager.collectSpatial(index);

    for (let i = 0; i < gravityAnchors.length; i++) {
        const a = gravityAnchors[i];
        if (!a.userData.tetherable) continue;
        index.add(a.position.x, a.position.y, a.position.z, 0.01, CollisionLayer.Tether, i, 'tether', a);
    }
    const slingTargets = game.slingableObjectSystem.getTetherTargets();
    for (let i = 0; i < slingTargets.length; i++) {
        const t = slingTargets[i];
        index.add(t.position.x, t.position.y, t.position.z, 0.01, CollisionLayer.Tether, i, 'tether', t);
    }

    const boss = game.bossManager?.getBoss?.();
    if (boss && typeof boss.collectWasmHitboxes === 'function') {
        const boxes = boss.collectWasmHitboxes();
        for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            index.add(b.x, b.y, 0, b.radius, CollisionLayer.Boss, i, 'boss');
        }
    }

    const projectiles = game.weaponSystem?.getActiveProjectiles?.() ?? [];
    for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        if (!p.active) continue;
        const pos = p.mesh.position;
        index.add(pos.x, pos.y, pos.z, 0.5, CollisionLayer.Projectile, i, 'projectile');
    }

    index.commit();
    const handle = index.getHandle();
    if (handle) {
        game.wasmMemory = handle.memory;
        game.wasmExports = handle.exports;
    }
}
