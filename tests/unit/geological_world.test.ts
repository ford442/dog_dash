import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createGeologicalWorld } from '../../src/geological/world.ts';
import {
    createSporeCloudAtPosition,
    createJellyMossAtPosition,
    createGeodeAtPosition,
    createVoidRootBallAtPosition,
    createVacuumKelpAtPosition,
    createIceNeedleClusterAtPosition,
    createMagmaHeartAtPosition,
    createGravityAnchorAtPosition,
    createLiquidMetalBlobAtPosition,
    createStarEnvMap
} from '../../src/environment.ts';
import { jellyMossSoftBody } from '../../src/jelly_moss_softbody.ts';
import { verletBodyPool } from '../../src/verlet_body_pool.ts';
import { vacuumKelpSoftBody } from '../../src/geological/vacuum_kelp.ts';
import { LiquidMetalSystem } from '../../src/geological/liquid_metal.ts';
import { SpatialIndex, CollisionLayer } from '../../src/spatial_index.ts';
import { decorationBudget } from '../../src/decoration_budget.ts';
import { beginRun, createDefaultRunSeed } from '../../src/run_seed/index.ts';
import type { WasmExports, WasmHandle } from '../../src/wasm_loader.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const GEOLOGICAL_ARRAY_NAMES = [
    'sporeClouds',
    'jellyMosses',
    'geodes',
    'voidRootBalls',
    'vacuumKelps',
    'iceNeedleClusters',
    'magmaHearts',
    'gravityAnchors',
    'liquidMetalBlobs'
] as const;

async function loadTestWasmHandle(): Promise<WasmHandle> {
    const bytes = await readFile(resolve(ROOT, 'public/build/optimized.wasm'));
    const { instance } = await WebAssembly.instantiate(bytes, {
        env: { abort: () => { throw new Error('wasm abort'); } }
    });
    const exports = instance.exports as unknown as WasmExports;
    return {
        backend: 'as',
        exports,
        getF32View(byteOffset: number, length: number): Float32Array {
            return new Float32Array(exports.memory.buffer, byteOffset, length);
        }
    };
}

test('grep gate: environment.ts exports no geological arrays and no dead updateGeologicalObjects', () => {
    const envSrc = readFileSync(resolve(ROOT, 'src/environment.ts'), 'utf8');

    for (const arrayName of GEOLOGICAL_ARRAY_NAMES) {
        const exportPattern = new RegExp(`export\\s+(?:const|let|var)\\s+${arrayName}\\b`);
        assert.equal(
            exportPattern.test(envSrc),
            false,
            `src/environment.ts must not export module-level array '${arrayName}'`
        );
    }

    assert.equal(
        /\bupdateGeologicalObjects\b/.test(envSrc),
        false,
        'src/environment.ts must not define dead twin updateGeologicalObjects'
    );
    assert.equal(
        /\bfunction\s+generateEnvironment\b/.test(envSrc),
        false,
        'generateEnvironment must be renamed to createStarEnvMap'
    );
    assert.equal(typeof createStarEnvMap, 'function');
});

test('grep gate: solar sails have one implementation (solar_sail_ferns, streamed by foliage_streaming)', () => {
    // The pre-streaming sail (foliage/plants_advanced createSolarSail +
    // GeologicalWorld.solarSails + createSolarSailAtPosition) was removed. A
    // second sail path would be picked up by new flora/Endless brushes by mistake.
    const srcDir = resolve(ROOT, 'src');
    const files = (readdirSync(srcDir, { recursive: true }) as string[])
        .filter((f) => f.endsWith('.ts'));
    const deadSailApi = /\b(solarSails|createSolarSail|createSolarSailAtPosition|updateSolarSail)\b/;
    const offenders = files.filter((f) => deadSailApi.test(readFileSync(resolve(srcDir, f), 'utf8')));
    assert.deepEqual(offenders, [], 'dead solar-sail twin referenced; use solar_sail_ferns.ts');

    const world = createGeologicalWorld({ scene: new THREE.Scene() });
    assert.equal('solarSails' in world, false, 'GeologicalWorld must not carry a solarSails array');
});

test('grep gate: loop and gameplay modules do not import geological arrays or scene/player singletons', () => {
    const loopAndDomainFiles = [
        'src/main/loop_core.ts',
        'src/main/loop_geological.ts',
        'src/main/loop_world.ts',
        'src/main/loop_finish.ts',
        'src/main/loop_combat/index.ts',
        'src/main/loop_combat/boss.ts',
        'src/main/loop_combat/friends.ts',
        'src/main/loop_combat/weapons.ts',
        'src/main/loop_combat/powerups.ts',
        'src/main/loop_combat/pickups.ts',
        'src/main/obstacle_setup.ts',
        'src/main/spawn_helpers.ts',
        'src/main/player_update.ts',
        'src/main/camera_system.ts',
        'src/main/render_helpers.ts',
        'src/main/music_update.ts',
        'src/main/frame_housekeeping.ts',
        'src/main/game_loop.ts',
        'src/main/grenade.ts',
        'src/main/dream_portal_update.ts',
        'src/main/artifact_update.ts',
        'src/main/grav_lens_update.ts',
        'src/spatial_fill.ts',
        'src/input_system.ts'
    ];

    const arrayExportRegex = new RegExp(`\\b(${GEOLOGICAL_ARRAY_NAMES.join('|')})\\b`);

    for (const relPath of loopAndDomainFiles) {
        const content = readFileSync(resolve(ROOT, relPath), 'utf8');
        const importLines = content
            .split('\n')
            .filter((line) => /^\s*import\b/.test(line));

        for (const line of importLines) {
            if (line.includes('environment')) {
                assert.equal(
                    arrayExportRegex.test(line),
                    false,
                    `${relPath} must not import geological array from environment.ts: ${line}`
                );
            }
            assert.equal(
                line.includes('player_loader'),
                false,
                `${relPath} must not import player from player_loader.ts: ${line}`
            );
            if (line.includes('scene_context')) {
                assert.equal(
                    /\b(scene|camera|mainLight)\b/.test(line),
                    false,
                    `${relPath} must not import scene/camera/mainLight from scene_context.ts: ${line}`
                );
            }
        }
    }
});

test('import-time gate: scene_context and player_loader do not construct scene or start GLTF load on import', async () => {
    const sceneContextSrc = readFileSync(resolve(ROOT, 'src/scene_context.ts'), 'utf8');
    const beforeInitFn = sceneContextSrc.split('export function createSceneObjects')[0] ?? '';
    assert.equal(
        /new\s+THREE\.Scene\s*\(/.test(beforeInitFn),
        false,
        'src/scene_context.ts must not call new THREE.Scene() at module top-level'
    );

    const playerLoaderSrc = readFileSync(resolve(ROOT, 'src/player_loader.ts'), 'utf8');
    const beforeLoadPlayerFn = playerLoaderSrc.split('export function loadPlayer')[0] ?? '';
    assert.equal(
        /gltfLoader\.load\s*\(/.test(beforeLoadPlayerFn),
        false,
        'src/player_loader.ts must not call gltfLoader.load() at module top-level'
    );

    const sceneContextMod = await import('../../src/scene_context.ts');
    const playerLoaderMod = await import('../../src/player_loader.ts');

    // Before bootstrap, player is null and rocket.glb has not been requested.
    assert.equal(playerLoaderMod.player, null);

    // Calling loadPlayer under stub / skip_gpu_boot builds a placeholder mesh without fetching rocket.glb.
    const testScene = new THREE.Scene();
    assert.equal(typeof sceneContextMod.createSceneObjects, 'function');
    const loadedPlayer = await playerLoaderMod.loadPlayer(testScene, { stub: true });
    assert.ok(loadedPlayer instanceof THREE.Group, 'stub loadPlayer should return a THREE.Group');
    assert.equal(testScene.children.includes(loadedPlayer), true, 'stub player should be added to target scene');
});

test('GeologicalWorld.reset(): spawn -> reset -> spawn does not grow array, SpatialIndex, or WASM Verlet body counts', async () => {
    const wasm = await loadTestWasmHandle();
    jellyMossSoftBody.bindWasm(wasm);
    jellyMossSoftBody.setLevelEnabled(true);
    jellyMossSoftBody.clear();
    vacuumKelpSoftBody.clear();

    const scene = new THREE.Scene();
    const spatialIndex = new SpatialIndex();
    const liquidMetalSystem = new LiquidMetalSystem(scene);
    const world = createGeologicalWorld({
        scene,
        spatialIndex,
        getLiquidMetalSystem: () => liquidMetalSystem
    });

    const spawnAllOnce = () => {
        beginRun(createDefaultRunSeed(424242));
        createSporeCloudAtPosition(world, 10, 0, 0);
        createJellyMossAtPosition(world, 20, 0, 0);
        createGeodeAtPosition(world, 50, 0, 0);
        createVoidRootBallAtPosition(world, 60, 0, 0);
        createVacuumKelpAtPosition(world, 70, 0, 0);
        createIceNeedleClusterAtPosition(world, 80, 0, 0);
        createMagmaHeartAtPosition(world, 90, 0, 0);
        createGravityAnchorAtPosition(world, 100, 0, 0);
        createLiquidMetalBlobAtPosition(world, 110, 0, 0);

        // Step soft-body simulation once.
        jellyMossSoftBody.update(1 / 60);
        vacuumKelpSoftBody.applyForces(1);
        verletBodyPool.step(1 / 60, 0);
        vacuumKelpSoftBody.syncVisuals();

        // Populate SpatialIndex with the spawned spore clouds and gravity anchors.
        spatialIndex.begin();
        for (let i = 0; i < world.sporeClouds.length; i++) {
            const c = world.sporeClouds[i];
            spatialIndex.add(c.position.x, c.position.y, c.position.z, c.radius, CollisionLayer.Spore, i, 'spore', c);
        }
        for (let i = 0; i < world.gravityAnchors.length; i++) {
            const p = world.gravityAnchors[i].position;
            spatialIndex.add(p.x, p.y, p.z, 12, CollisionLayer.Tether, i, 'tether', world.gravityAnchors[i]);
        }
        spatialIndex.commit();
    };

    // 1. First spawn pass
    spawnAllOnce();

    for (const key of GEOLOGICAL_ARRAY_NAMES) {
        assert.equal(world[key].length, 1, `expected 1 item in world.${key} after first spawn`);
    }
    const firstBodyCount = verletBodyPool.bodyCount;
    assert.ok(firstBodyCount > 0, 'expected WASM Verlet bodies to be allocated for jelly-moss + vacuum kelp');
    assert.equal(spatialIndex.count(), 2, 'expected SpatialIndex to hold spore + tether');
    const firstSceneChildren = scene.children.length;
    assert.ok(firstSceneChildren > 0, 'expected scene to contain spawned geological groups');

    // 2. Reset world
    world.reset();

    for (const key of GEOLOGICAL_ARRAY_NAMES) {
        assert.equal(world[key].length, 0, `expected world.${key} to be empty after reset()`);
    }
    assert.equal(verletBodyPool.bodyCount, 0, 'expected WASM Verlet body pool count to be 0 after reset()');
    assert.equal(jellyMossSoftBody.isActive, false, 'expected jellyMossSoftBody.isActive to be false after reset()');
    assert.equal(vacuumKelpSoftBody.usingVerlet, false, 'expected vacuumKelpSoftBody.usingVerlet to be false after reset()');
    assert.equal(spatialIndex.count(), 0, 'expected SpatialIndex to be cleared after reset()');
    assert.equal(scene.children.length, 0, 'expected all geological objects to be removed from scene after reset()');

    const budgetSnapshotAfterReset = decorationBudget.getSnapshot();
    for (const id of [
        'spore_clouds',
        'jelly_mosses',
        'solar_sails',
        'chroma_rocks',
        'geodes',
        'void_root_balls',
        'vacuum_kelps',
        'ice_needle_clusters',
        'magma_hearts',
        'gravity_anchors',
        'liquid_metal_blobs'
    ]) {
        const entry = budgetSnapshotAfterReset.find((e) => e.id === id);
        if (entry) {
            assert.equal(entry.currentActive, 0, `decorationBudget '${id}' should be 0 after reset()`);
        }
    }

    // 3. Second spawn pass: counts must match a single fresh spawn with zero growth/leak
    spawnAllOnce();

    for (const key of GEOLOGICAL_ARRAY_NAMES) {
        assert.equal(world[key].length, 1, `expected 1 item in world.${key} after second spawn`);
    }
    const secondMossCores = Math.min(8, world.jellyMosses[0].children[0]?.children.length ?? 0);
    const secondKelpNodes = (world.vacuumKelps[0].userData.nodes as number) ?? 0;
    assert.equal(
        verletBodyPool.bodyCount,
        secondMossCores + secondKelpNodes,
        'WASM Verlet body count after spawn -> reset -> spawn must equal only the newly spawned bodies (zero leak)'
    );
    assert.equal(spatialIndex.count(), 2, 'SpatialIndex entity count must match first spawn');
    assert.equal(scene.children.length, firstSceneChildren, 'Scene child count must match first spawn');

    // Clean up
    world.reset();
});
