import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    ASTEROID_KINDS,
    buildAsteroidGeometry,
    createAsteroidMaterial,
    getAsteroidGeometry
} from '../../src/hazard_art/asteroid_kit.ts';
import {
    CHAPTER_ENEMY,
    ENEMY_CHARACTER_IDS,
    createEnemyCharacter,
    enemyTellTarget,
    getEnemyRig,
    rollEnemyBodyColor,
    updateEnemyRig
} from '../../src/hazard_art/enemy_characters.ts';
import { createAsteroid, createPatternEnemy } from '../../src/obstacle_system/spawn_pools.ts';
import type { ObstacleSystemHost } from '../../src/obstacle_system/host.ts';
import { PitcherMinion, PITCHER_MINION_HITBOX_RADIUS } from '../../src/boss_system/pitcher_minion.ts';
import { ZephyrBoss } from '../../src/boss_system/zephyr_boss.ts';
import { ZEPHYR_EYE_RADIUS, ZEPHYR_SHIELD_RADIUS } from '../../src/boss_system/zephyr_rig.ts';
import { gpuResourceStats, isSharedResource } from '../../src/gpu_resources.ts';
import { artChapterFor } from '../../src/hazard_art/art_chapter.ts';
import { LEVEL_CONFIG } from '../../src/level_config.ts';
import { disposeObject } from '../../src/utils.ts';

function maxVertexRadius(geo: THREE.BufferGeometry): number {
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    let r = 0;
    for (let i = 0; i < pos.count; i++) r = Math.max(r, v.fromBufferAttribute(pos, i).length());
    return r;
}

function stubHost(level: number): ObstacleSystemHost {
    return {
        scene: new THREE.Scene(),
        obstacles: [],
        patternEnemies: [],
        options: { getCurrentLevel: () => level }
    } as unknown as ObstacleSystemHost;
}

test('asteroid kit: five shared, unit-radius, vertex-coloured shapes', () => {
    assert.equal(ASTEROID_KINDS.length, 5);
    const aspects = new Set<string>();
    for (const kind of ASTEROID_KINDS) {
        const geo = getAsteroidGeometry(kind);
        assert.equal(getAsteroidGeometry(kind), geo, `${kind} is built once and reused`);
        assert.ok(isSharedResource(geo), `${kind} is markShared`);
        assert.ok(geo.attributes.color, `${kind} has vertex colour`);
        // Collision uses userData.radius == scale, so the furthest vertex must sit at 1.
        assert.ok(Math.abs(maxVertexRadius(geo) - 1) < 1e-3, `${kind} normalised to radius 1`);
        const size = geo.boundingBox!.getSize(new THREE.Vector3());
        aspects.add([size.x, size.y, size.z].map((n) => n.toFixed(2)).join('x'));
    }
    assert.equal(aspects.size, 5, 'each kind has its own proportions (shape, not just colour)');
});

test('asteroid kit: ore rock has rock + vein groups and a matching material pair', () => {
    const geo = getAsteroidGeometry('ore');
    assert.equal(geo.groups.length, 2);
    const mats = createAsteroidMaterial('ore', 3);
    assert.ok(Array.isArray(mats) && mats.length === 2);
    assert.ok(!Array.isArray(createAsteroidMaterial('chunk', 3)));
});

test('asteroid kit: owned copies are not marked shared', () => {
    const copy = buildAsteroidGeometry('shard', 1.3);
    assert.ok(!isSharedResource(copy));
    assert.ok(Math.abs(maxVertexRadius(copy) - 1.3) < 1e-3);
    copy.dispose();
});

test('createAsteroid uses the shared kit geometry (no per-spawn clone) and teardown keeps it', () => {
    const host = stubHost(2);
    const a = createAsteroid(host, 10, 0, 0, 1.4);
    assert.equal(a.geometry, getAsteroidGeometry(a.userData.asteroidKind));
    assert.equal(a.userData.radius, 1.4);
    assert.equal(a.scale.x, 1.4);
    disposeObject(a);
    assert.ok(getAsteroidGeometry(a.userData.asteroidKind).attributes.position.count > 0);
});

test('enemy characters: one per chapter, each with a face on the -X front', () => {
    assert.deepEqual(
        Object.values(CHAPTER_ENEMY).sort(),
        [...ENEMY_CHARACTER_IDS].sort()
    );
    const vertexCounts = new Set<number>();
    for (const id of ENEMY_CHARACTER_IDS) {
        const mesh = createEnemyCharacter(id);
        const rig = getEnemyRig(mesh);
        assert.ok(rig, `${id} has a rig`);
        assert.ok(rig!.face.position.x < -0.4, `${id} face sits on the front (-X)`);
        const box = new THREE.Box3().setFromObject(mesh);
        const r = Math.max(...box.min.toArray().map(Math.abs), ...box.max.toArray().map(Math.abs));
        assert.ok(r > 0.7 && r < 1.7, `${id} is roughly unit size (got ${r.toFixed(2)})`);
        vertexCounts.add(mesh.geometry.attributes.position.count);
        disposeObject(mesh);
    }
    assert.equal(vertexCounts.size, ENEMY_CHARACTER_IDS.length, 'every character has its own body shape');
});

test('enemy characters share geometry but own their body/glow materials', () => {
    const a = createEnemyCharacter('krill');
    const b = createEnemyCharacter('krill');
    assert.equal(a.geometry, b.geometry);
    assert.ok(isSharedResource(a.geometry));
    assert.notEqual(a.material, b.material);
    assert.notEqual(getEnemyRig(a)!.glow, getEnemyRig(b)!.glow);
    disposeObject(a);
    // b still renders after a's teardown.
    assert.ok(b.geometry.attributes.position.count > 0);
    disposeObject(b);
});

test('enemy teardown frees its two owned materials exactly once', () => {
    // Krill and jelly reuse the body material on several child meshes.
    for (const id of ['krill', 'jelly_drifter', 'scorch_beetle'] as const) {
        const mesh = createEnemyCharacter(id);
        const before = gpuResourceStats.materialsDisposed;
        disposeObject(mesh);
        assert.equal(gpuResourceStats.materialsDisposed - before, 2, `${id}: body + glow`);
    }
});

test('enemy rig: telegraph ramps up near the player and never touches gameplay fields', () => {
    const host = stubHost(4);
    const enemy = createPatternEnemy(host, 20, 3, 0, 0.8, 0x996633, {
        type: 'sine_wave', centerX: 20, centerY: 3, count: 1, spacing: 2, speed: 1
    }, 0);
    const mesh = enemy.mesh;
    assert.equal(mesh.userData.rotationSpeed, 0, 'no NaN spin from the generic obstacle loop');
    const pos = mesh.position.clone();

    assert.equal(enemyTellTarget(20, 3, 0, 3), 0, 'player too far behind: no tell');
    assert.equal(enemyTellTarget(20, 3, 10, 4), 1, 'player ahead within range: tell');
    assert.equal(enemyTellTarget(20, 3, 25, 3), 0, 'player already past: no tell');

    for (let i = 0; i < 60; i++) updateEnemyRig(mesh, 1 / 60, i / 60, 1, 1);
    assert.ok(getEnemyRig(mesh)!.alert > 0.9);
    assert.equal(mesh.userData.radius, 0.8);
    assert.ok(mesh.position.equals(pos));
    assert.ok(Number.isFinite(mesh.rotation.x) && Number.isFinite(mesh.rotation.z));
});

test('enemy body colour: chapter tint recolours without replacing the character colour', () => {
    const tint = 0x66ff99;
    const c = new THREE.Color(rollEnemyBodyColor('rust_drone', tint));
    const t = new THREE.Color(tint);
    // The old code lerped 60% toward the tint; now it is at most ~30%.
    const dist = Math.hypot(c.r - t.r, c.g - t.g, c.b - t.b);
    assert.ok(dist > 0.2, 'not washed into the tint');
});

test('art chapter: campaign levels map to themselves, others follow their tint', () => {
    for (let ch = 1; ch <= 6; ch++) assert.equal(artChapterFor(ch), ch);
    // Endless chapters copy their twin's enemyTintColor exactly.
    for (let ch = 1; ch <= 6; ch++) {
        assert.equal(artChapterFor(101, { enemyTintColor: LEVEL_CONFIG[ch].enemyTintColor } as never), ch);
    }
    assert.equal(artChapterFor(301, {} as never), 1);
});

test('pitcher minion: visible body sits on its hitbox (no double parent offset)', () => {
    const scene = new THREE.Scene();
    const boss = new THREE.Group();
    boss.position.set(500, 12, -20);
    scene.add(boss);
    const minion = new PitcherMinion(boss, 0, 3);
    minion.update(1 / 60, boss.position, 1);
    scene.updateMatrixWorld(true);
    const world = minion.group.getWorldPosition(new THREE.Vector3());
    const hb = minion.getHitbox();
    assert.ok(Math.abs(world.x - hb.x) < 1e-6 && Math.abs(world.y - hb.y) < 1e-6);
    assert.equal(hb.radius, PITCHER_MINION_HITBOX_RADIUS);
    // Measure in the minion's own frame across a full chomp/flap cycle: the
    // furthest visible point must fit the hitbox.
    let reach = 0;
    const v = new THREE.Vector3();
    for (let t = 0; t < 3; t += 0.05) {
        minion.update(1 / 60, boss.position, t, t > 1.5);
        minion.group.position.set(0, 0, 0);
        minion.group.quaternion.identity();
        scene.updateMatrixWorld(true);
        minion.group.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            const pos = mesh.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).sub(boss.position);
                reach = Math.max(reach, Math.hypot(v.x, v.y, v.z));
            }
        });
    }
    assert.ok(reach <= PITCHER_MINION_HITBOX_RADIUS, `body fits its hitbox (reach=${reach.toFixed(2)})`);
    minion.destroy();
});

test('zephyr: hitboxes track the rig (eye when exposed, wreath when shielded)', () => {
    const boss = new ZephyrBoss(new THREE.Scene(), { spawnX: 0, arenaWidth: 60, health: 200 }, {
        onDefeated: () => {},
        onPlayerHit: () => {},
        getPlayerPosition: () => new THREE.Vector3(-30, 0, 0)
    });
    boss.weakPointExposed = false;
    assert.equal(boss.collectWasmHitboxes()[0].radius, ZEPHYR_SHIELD_RADIUS);
    boss.weakPointExposed = true;
    assert.equal(boss.collectWasmHitboxes()[0].radius, 4);
    assert.ok(ZEPHYR_EYE_RADIUS <= 4);
    boss.destroy();
});
