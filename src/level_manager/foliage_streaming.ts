import * as THREE from 'three';
import { type LevelConfig } from '../level_config';
import {
    createSubwooferLotus,
    createShrub,
    createVine,
    createPuffballFlower,
    createGlowingFlower,
    createStarDustFern,
    createNebulaRose,
    createFloweringTree,
    createFloatingOrb
} from '../foliage';
import { DEPTH_LAYERS, randomZInLayer, randomZInRange } from '../depth_layers';
import { moonPlants } from '../visuals';
import { decorationBudget } from '../decoration_budget';
import { biomeNoise } from '../biome_noise';
import { STREAM_AHEAD_END, STREAM_AHEAD_START } from './constants';
import type { LevelFoliageHost } from './foliage_host';


export function maybeStreamFoliage(lm: LevelFoliageHost, cameraX: number) {
        const cfg = lm.config[lm.currentLevel];
        if (!cfg) return;

        const targetEnd = cameraX + STREAM_AHEAD_END;
        if (targetEnd <= lm.lastPopulatedEndX) return;

        const startX = Math.max(lm.lastPopulatedEndX, cameraX + STREAM_AHEAD_START);
        populateZone(lm, startX, targetEnd, cfg);
    }
export function populateZone(lm: LevelFoliageHost, startX: number, endX: number, config: LevelConfig) {
        if (endX <= lm.lastPopulatedEndX) return;
        lm.lastPopulatedEndX = endX;

        const width = endX - startX;
        if (width <= 0) return;

        const density = config.foliageDensity;
        const levelType = config.levelType || 'open';

        const streamPinwheels = (yRange: [number, number]) => {
            if (config.pinwheelDensity && config.pinwheelDensity > 0) {
                lm.pinwheelManager.streamChunk(startX, width, config.pinwheelDensity, yRange);
            }
        };

        const streamWindChimes = () => {
            if (config.windChimeDensity && config.windChimeDensity > 0) {
                lm.windChimeManager.streamChunk(startX, width, config.windChimeDensity, [6, 24]);
            }
        };

        if (levelType === 'tunnel') {
            const interval = config.obstacleInterval || 20;
            const sectionCount = Math.floor(width / interval);

            for (let i = 0; i < sectionCount; i++) {
                const xPos = startX + i * interval;
                lm.industrialGeometryManager.createIndustrialSection(xPos);
            }

            const tunnelHeight = config.tunnelHeight || 15;
            const yRange: [number, number] = [-tunnelHeight / 2 + 2, tunnelHeight / 2 - 2];
            spawnOpenFoliage(lm, startX, width, density, config, yRange);
            streamPinwheels(yRange);
            streamWindChimes();
            return;
        }

        if (levelType === 'organic_tunnel') {
            const interval = config.obstacleInterval || 25;
            const sectionCount = Math.floor(width / interval);

            for (let i = 0; i < sectionCount; i++) {
                const xPos = startX + i * interval;
                lm.industrialGeometryManager.createWhaleRibSection(xPos);
            }

            const tunnelHeight = config.tunnelHeight || 20;
            const yRange: [number, number] = [-tunnelHeight / 2 + 3, tunnelHeight / 2 - 3];
            spawnOpenFoliage(lm, startX, width, density, config, yRange);
            streamPinwheels(yRange);
            streamWindChimes();
            return;
        }

        spawnOpenFoliage(lm, startX, width, density, config);
        streamPinwheels([-18, 18]);
        streamWindChimes();
    }


export function trackFoliageSpawn(lm: LevelFoliageHost, obj: THREE.Object3D): boolean {
        if (!decorationBudget.canSpawn('foliage_scatter')) return false;
        if (!decorationBudget.reportSpawn('foliage_scatter')) return false;
        lm.scene.add(obj);
        lm.levelObjects.push(obj);
        moonPlants.push(obj);
        return true;
    }
export function spawnOpenFoliage(lm: LevelFoliageHost,
        startX: number,
        width: number,
        density: LevelConfig['foliageDensity'],
        levelConfig: LevelConfig,
        yRange: [number, number] = [-20, 20]
    ) {
        // Chunk-cached biome noise (C++ fractalNoise2D under VITE_CPP_WASM=true, JS fallback otherwise)
        // varies foliage/void-root scatter density per world X instead of a flat multiplier.
        const foliageDensityMul = biomeNoise.densityMultiplier(startX + width / 2, 'foliage');
        const scaledCount = (count: number) =>
            Math.max(0, Math.floor(count * lm.objectDensityMultiplier * foliageDensityMul));
        const foliageZ: [number, number] = [DEPTH_LAYERS.MIDGROUND.min, DEPTH_LAYERS.MIDGROUND.max];
        const geoZ: [number, number] = [DEPTH_LAYERS.BACKGROUND.min + 5, DEPTH_LAYERS.MIDGROUND.max];
        const vignettes = levelConfig.vignettes || {};
        const vignetteCount = (base: number | undefined) =>
            base ? Math.max(0, Math.floor(scaledCount(base * (width / 100)))) : 0;
        // Geode clearings: plan centers first so base fern scatter thins near safe harbors
        type ClearingCenter = { x: number; y: number; radius: number };
        const geodeClearings: ClearingCenter[] = [];
        if ((vignettes.geodeClearings || 0) > 0) {
            const nClearings = vignetteCount(vignettes.geodeClearings);
            const geodeCap = Math.max(
                0,
                lm.GEOLOGICAL_SPAWN_CAPS.geode - lm.geologicalCounts.geodes()
            );
            for (let c = 0; c < Math.min(nClearings, geodeCap); c++) {
                geodeClearings.push({
                    x: startX + Math.random() * width,
                    y: yRange[0] + Math.random() * (yRange[1] - yRange[0]),
                    radius: 12 + Math.random() * 5
                });
            }
        }
        const isInClearing = (x: number, y: number) =>
            geodeClearings.some((c) => {
                const dx = x - c.x;
                const dy = y - c.y;
                return dx * dx + dy * dy < c.radius * c.radius;
            });
        const track = (obj: THREE.Object3D) => trackFoliageSpawn(lm, obj);
        const spawn = (
            count: number,
            creatorFn: () => THREE.Object3D,
            customYRange = yRange,
            zRange: [number, number] = foliageZ,
            speciesId?: string,
            rejectPosition?: (x: number, y: number) => boolean
        ) => {
            for (let i = 0; i < scaledCount(count); i++) {
                let x = 0;
                let y = 0;
                let placed = false;
                for (let attempt = 0; attempt < 5; attempt++) {
                    x = startX + Math.random() * width;
                    y = customYRange[0] + Math.random() * (customYRange[1] - customYRange[0]);
                    if (!rejectPosition || !rejectPosition(x, y)) {
                        placed = true;
                        break;
                    }
                }
                if (!placed || (rejectPosition && rejectPosition(x, y))) continue;
                const z = randomZInRange(zRange);
                const obj = creatorFn();
                obj.position.set(x, y, z);
                const s = 0.8 + Math.random() * 0.5;
                obj.scale.set(s, s, s);
                if (speciesId) obj.userData.speciesId = speciesId;
                if (!trackFoliageSpawn(lm, obj)) continue;
            }
        };
        if (density.fern) {
            spawn(
                density.fern,
                () => createStarDustFern({ color: 0x8A2BE2 }),
                yRange,
                foliageZ,
                'fern',
                isInClearing
            );
        }
        if (density.rose) spawn(density.rose, () => createNebulaRose({ color: 0xFF1493 }), yRange, foliageZ, 'rose');
        if (density.lotus) spawn(density.lotus, () => createSubwooferLotus({ color: 0x00ff88 }), yRange, foliageZ, 'lotus');
        if (density.glowingFlower) spawn(density.glowingFlower, () => createGlowingFlower({ color: 0x00ffff, intensity: 2.0 }), yRange, foliageZ, 'glowingFlower');
        const bandHeight = yRange[1] - yRange[0];
        // Open levels: trees sit in the lower sky band. Tunnels: use lower third of flyable height.
        const treeYRange: [number, number] = bandHeight < 16
            ? [yRange[0] + bandHeight * 0.12, yRange[0] + bandHeight * 0.42]
            : [Math.max(yRange[0], -20), Math.min(yRange[1], -5)];
        if (density.tree) spawn(density.tree, () => createFloweringTree({ color: 0x44ffaa }), treeYRange, foliageZ, 'tree');
        if (density.floweringTree) spawn(density.floweringTree, () => createFloweringTree({ color: 0xffaa44 }), treeYRange, foliageZ, 'floweringTree');
        if (density.shrub) spawn(density.shrub, () => createShrub({ color: 0x32CD32 }), yRange, foliageZ, 'shrub');
        if (density.vine) spawn(density.vine, () => createVine({ color: 0x228B22 }), yRange, foliageZ, 'vine');
        if (density.mushroom) spawn(density.mushroom, () => createPuffballFlower({ color: 0xFF4500 }), yRange, foliageZ, 'mushroom');
        if (density.orb) spawn(density.orb, () => createFloatingOrb({ color: 0x88ccff }), yRange, foliageZ, 'orb');
        if (density.solarSail && density.solarSail > 0) {
            lm.solarSailFernManager.streamChunk(startX, width, density.solarSail, yRange);
        }
        if (levelConfig.chimeDensity && levelConfig.chimeDensity > 0) {
            lm.crystalChimeManager.streamChunk(startX, width, levelConfig.chimeDensity, yRange);
        }
        spawnFoliageVignettes(lm, startX, width, density, yRange, treeYRange, foliageZ, geoZ, vignettes, vignetteCount, geodeClearings);
        if (density.cloud) {
            // Independent noise sample (own channel) so spore-cloud rate doesn't move in lockstep with foliage.
            const sporeDensityMul = biomeNoise.densityMultiplier(startX + width / 2, 'spore');
            const targetCount = Math.min(
                Math.max(0, Math.floor(density.cloud * lm.objectDensityMultiplier * sporeDensityMul)),
                Math.max(0, lm.GEOLOGICAL_SPAWN_CAPS.cloud - lm.geologicalCounts.sporeClouds())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInLayer('BACKGROUND');
                lm.spawners.createSporeCloudAtPosition(x, y, z);
            }
        }
        if (density.voidRootBall) {
            const targetCount = Math.min(
                scaledCount(density.voidRootBall),
                Math.max(0, lm.GEOLOGICAL_SPAWN_CAPS.voidRootBall - lm.geologicalCounts.voidRootBalls())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                lm.spawners.createVoidRootBallAtPosition(x, y, z);
            }
        }
        if (density.vacuumKelp) {
            const targetCount = Math.min(
                scaledCount(density.vacuumKelp),
                Math.max(0, lm.GEOLOGICAL_SPAWN_CAPS.vacuumKelp - lm.geologicalCounts.vacuumKelps())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * 15;
                const z = randomZInRange(geoZ);
                lm.spawners.createVacuumKelpAtPosition(x, y, z);
            }
        }
        if (density.iceNeedle) {
            const targetCount = Math.min(
                scaledCount(density.iceNeedle),
                Math.max(0, lm.GEOLOGICAL_SPAWN_CAPS.iceNeedle - lm.geologicalCounts.iceNeedleClusters())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                lm.spawners.createIceNeedleClusterAtPosition(x, y, z);
            }
        }
        if (levelConfig.chromaShiftDensity && levelConfig.chromaShiftDensity > 0) {
            const count = Math.min(scaledCount(levelConfig.chromaShiftDensity), 200);
            for (let i = 0; i < count; i++) {
                const x = startX + Math.random() * width;
                const y = Math.random() * (yRange[1] - yRange[0]) + yRange[0];
                const z = randomZInLayer('NEAR');
                lm.chromaShiftSystem.addRock(new THREE.Vector3(x, y, z), 2 + Math.random() * 2);
            }
        }
        if (density.liquidMetal) {
            const targetCount = Math.min(scaledCount(density.liquidMetal), lm.GEOLOGICAL_SPAWN_CAPS.liquidMetal);
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                lm.spawners.createLiquidMetalBlobAtPosition(x, y, z);
            }
        }
        if (density.magmaHeart) {
            const targetCount = Math.min(
                scaledCount(density.magmaHeart),
                Math.max(0, lm.GEOLOGICAL_SPAWN_CAPS.magmaHeart - lm.geologicalCounts.magmaHearts())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                lm.spawners.createMagmaHeartAtPosition(x, y, z);
            }
        }
        if (density.gravityAnchor) {
            const targetCount = Math.min(
                scaledCount(density.gravityAnchor),
                Math.max(0, lm.GEOLOGICAL_SPAWN_CAPS.gravityAnchor - lm.geologicalCounts.gravityAnchors())
            );
            for (let i = 0; i < targetCount; i++) {
                const x = startX + Math.random() * width;
                const y = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const z = randomZInRange(geoZ);
                lm.spawners.createGravityAnchorAtPosition(x, y, z, lm.currentLevel);
            }
        }
    }
export function spawnFoliageVignettes(lm: LevelFoliageHost,
        startX: number,
        width: number,
        density: LevelConfig['foliageDensity'],
        yRange: [number, number],
        treeYRange: [number, number],
        foliageZ: [number, number],
        geoZ: [number, number],
        vignettes: NonNullable<LevelConfig['vignettes']>,
        vignetteCount: (base: number | undefined) => number,
        geodeClearings: { x: number; y: number; radius: number }[]
    ) {
        // Tree groves: 3–6 trees in ~14 unit X cluster, shared tight Y band
        if ((vignettes.treeGroves || 0) > 0 && (density.tree || density.floweringTree)) {
            const nGroves = vignetteCount(vignettes.treeGroves);
            for (let g = 0; g < nGroves; g++) {
                const gx = startX + Math.random() * width;
                const gY = treeYRange[0] + Math.random() * (treeYRange[1] - treeYRange[0]);
                const gSize = 3 + Math.floor(Math.random() * 4);
                const gZ = randomZInRange(foliageZ);
                const isFlowering = density.floweringTree && (Math.random() < 0.5 || !density.tree);
                for (let t = 0; t < gSize; t++) {
                    const tx = gx + (Math.random() - 0.5) * 14;
                    const ty = gY + (Math.random() - 0.5) * 2.5;
                    const tz = gZ + (Math.random() - 0.5) * 2;
                    const creator = isFlowering
                        ? () => createFloweringTree({ color: 0xffaa44 })
                        : () => createFloweringTree({ color: 0x44ffaa });
                    const obj = creator();
                    obj.position.set(tx, ty, tz);
                    const s = 0.75 + Math.random() * 0.35;
                    obj.scale.set(s, s, s);
                    obj.userData.speciesId = isFlowering ? 'floweringTree' : 'tree';
                    trackFoliageSpawn(lm, obj);
                }
            }
        }
        // Rose arches: pairs offset in X/Z framing a vertical gap (encourages diving)
        if ((vignettes.roseArches || 0) > 0 && density.rose) {
            const nArches = vignetteCount(vignettes.roseArches);
            for (let a = 0; a < nArches; a++) {
                const ax = startX + Math.random() * width;
                const az = randomZInRange(foliageZ);
                const gapY = yRange[0] + Math.random() * (yRange[1] - yRange[0]);
                const sep = 5.5 + Math.random() * 3.5;
                const obj1 = createNebulaRose({ color: 0xFF1493 });
                obj1.position.set(ax - 1.5, gapY - sep * 0.5, az - 0.8);
                let s = 0.65 + Math.random() * 0.25;
                obj1.scale.set(s, s, s);
                obj1.userData.speciesId = 'rose';
                trackFoliageSpawn(lm, obj1);
                const obj2 = createNebulaRose({ color: 0xFF1493 });
                obj2.position.set(ax + 1.5, gapY + sep * 0.5, az + 0.8);
                s = 0.65 + Math.random() * 0.25;
                obj2.scale.set(s, s, s);
                obj2.userData.speciesId = 'rose';
                trackFoliageSpawn(lm, obj2);
            }
        }
        // Geode clearings: spawn FracturedGeode safe harbors at pre-planned centers
        for (const clearing of geodeClearings) {
            const z = randomZInRange(geoZ);
            lm.spawners.createGeodeAtPosition(clearing.x, clearing.y, z);
        }
    }
