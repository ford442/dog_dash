import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { decorationBudget } from '../../src/decoration_budget.ts';
import { ComboCorridorSystem } from '../../src/combo_corridor.ts';
import { GrappleIslesSystem } from '../../src/grapple_isles.ts';
import { SkyRailTerminalSystem } from '../../src/sky_rail_terminal.ts';
import { SpaceGardenSystem } from '../../src/space_garden.ts';
import { BouncePadsSystem } from '../../src/bounce_pads.ts';
import { ShootingStarsSystem } from '../../src/shooting_stars.ts';
import { FlowerConstellationsSystem } from '../../src/flower_constellations_system.ts';
import { CloudCastlesSystem } from '../../src/cloud_castles_system.ts';
import { AerialGuardPatrolSystem } from '../../src/aerial_guard_patrol.ts';
import { TimeShiftZonesSystem } from '../../src/time_shift_zones.ts';
import { WindCurrentsSystem } from '../../src/wind_currents.ts';
import { SingingGeodeSystem } from '../../src/singing_geodes.ts';

/**
 * Coverage for the 12 env systems that spawn 3D props but historically never
 * registered with `decoration_budget.ts` (CLAUDE.md's "New 3D props ... must
 * register with decoration_budget.ts before spawning" rule). This test
 * constructs each system directly against a bare `THREE.Scene` — no
 * renderer, no DOM, no GameContext — and asserts that activating it produces
 * a `decorationBudget` count that is present and never exceeds the declared
 * `maxActive`.
 *
 * Why a bare scene works here: all 12 of these modules build their geometry
 * with plain `THREE.InstancedMesh`/`THREE.Object3D` math and TSL node-graph
 * construction (`three/tsl`, `three/webgpu`), none of which touches
 * `document`/`window`/canvas at construction or activation time. This was
 * verified empirically (each of the 12 modules imports and its class
 * constructs + activates cleanly under plain `node --test`) before writing
 * this test — see the PR description for the probe. That's also why the
 * Playwright smoke test (`tests/smoke.spec.ts`) is *not* used for this:
 * `initializeSceneAndRenderer` (see `src/main/startup.ts`) throws
 * `WebGpuBootError` before `createGameSystems` — and therefore before any env
 * system — ever runs under headless Chrome, and `?skip_gpu_boot` only
 * short-circuits the probe itself, it still never reaches scene construction.
 * A `node --test` unit test that imports these modules directly, bypassing
 * the whole game bootstrap and `ENV_SYSTEM_MANIFEST`, is the only way to
 * exercise them in CI at all.
 *
 * Coverage: all 12 target systems import and activate successfully under
 * plain Node — this file covers all 12, with no gaps.
 */

test('combo_corridor: registers and reports its fixed ring count', () => {
    const scene = new THREE.Scene();
    const sys = new ComboCorridorSystem(scene);
    sys.activate({ density: 1 });

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'combo_corridor');
    assert.ok(entry, 'combo_corridor should be registered');
    assert.equal(entry!.currentActive, 40);
    assert.ok(entry!.currentActive <= entry!.maxActive);

    sys.deactivate();
    const after = decorationBudget.getSnapshot().find((e) => e.id === 'combo_corridor');
    assert.equal(after!.currentActive, 0);
});

test('grapple_isles: registers and reports the summed 4-layer count', () => {
    const scene = new THREE.Scene();
    const sys = new GrappleIslesSystem(scene);
    sys.activate();

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'grapple_isles');
    assert.ok(entry, 'grapple_isles should be registered');
    assert.equal(entry!.currentActive, 50);
    assert.ok(entry!.currentActive <= entry!.maxActive);
});

test('sky_rail_terminal: registers rails and terminals as two ids', () => {
    const scene = new THREE.Scene();
    const sys = new SkyRailTerminalSystem(scene);
    sys.activate();

    const rails = decorationBudget.getSnapshot().find((e) => e.id === 'sky_rail_terminal_rails');
    const terminals = decorationBudget.getSnapshot().find((e) => e.id === 'sky_rail_terminal_terminals');
    assert.ok(rails && terminals, 'both sky_rail_terminal ids should be registered');
    assert.equal(rails!.currentActive, 60);
    assert.equal(terminals!.currentActive, 10);
    assert.ok(rails!.currentActive <= rails!.maxActive);
    assert.ok(terminals!.currentActive <= terminals!.maxActive);
});

test('space_garden: registers and reports its fixed count', () => {
    const scene = new THREE.Scene();
    const sys = new SpaceGardenSystem(scene);
    sys.activate();

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'space_garden');
    assert.ok(entry, 'space_garden should be registered');
    assert.equal(entry!.currentActive, 80);
    assert.ok(entry!.currentActive <= entry!.maxActive);
});

test('bounce_pads: syncs to the config-driven pad count, not pool size', () => {
    const scene = new THREE.Scene();
    const sys = new BouncePadsSystem(scene);
    sys.activate({ pads: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'bounce_pads');
    assert.ok(entry, 'bounce_pads should be registered');
    assert.equal(entry!.currentActive, 2);
    assert.ok(entry!.currentActive <= entry!.maxActive);
});

test('shooting_stars: registers and reports its fixed count', () => {
    const scene = new THREE.Scene();
    const particleStub = { emit: () => {} } as any;
    const sys = new ShootingStarsSystem(scene, particleStub);
    sys.activate();

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'shooting_stars');
    assert.ok(entry, 'shooting_stars should be registered');
    assert.equal(entry!.currentActive, 25);
    assert.ok(entry!.currentActive <= entry!.maxActive);
});

test('flower_constellations: reports the generated flower count', () => {
    const scene = new THREE.Scene();
    const audioStub = { play: () => {} } as any;
    const particleStub = { emit: () => {} } as any;
    const sys = new FlowerConstellationsSystem(scene, audioStub, particleStub);
    sys.activate(true, 2000);

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'flower_constellations');
    assert.ok(entry, 'flower_constellations should be registered');
    assert.equal(entry!.currentActive, 15);
    assert.ok(entry!.currentActive <= entry!.maxActive);
});

test('cloud_castles: bookkeeping via reportSpawn/reportDestroy stays within budget', () => {
    const scene = new THREE.Scene();
    const sys = new CloudCastlesSystem(scene);
    sys.activate();
    sys.update(0.016, 0);

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'cloud_castles');
    assert.ok(entry, 'cloud_castles should be registered');
    assert.ok(entry!.currentActive > 0, 'maintainCastles() should have spawned at least one castle');
    assert.ok(entry!.currentActive <= entry!.maxActive);

    sys.deactivate();
    const after = decorationBudget.getSnapshot().find((e) => e.id === 'cloud_castles');
    assert.equal(after!.currentActive, 0);
});

test('aerial_guard_patrol: syncs to the config-driven zone count, not pool size', () => {
    const scene = new THREE.Scene();
    const sys = new AerialGuardPatrolSystem(scene);
    sys.activate({
        zones: [
            { x: 0, y: 0, z: 0, width: 10, searchRadius: 10 },
            { x: 10, y: 0, z: 0, width: 10, searchRadius: 10 },
            { x: 20, y: 0, z: 0, width: 10, searchRadius: 10 }
        ]
    });

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'aerial_guard_patrol');
    assert.ok(entry, 'aerial_guard_patrol should be registered');
    assert.equal(entry!.currentActive, 3);
    assert.ok(entry!.currentActive <= entry!.maxActive);
});

test('time_shift_zones: syncs to the configured zone count', () => {
    const scene = new THREE.Scene();
    const sys = new TimeShiftZonesSystem(scene);
    sys.activate({
        zones: [
            { x: 0, y: 0, width: 10, height: 10 },
            { x: 10, y: 0, width: 10, height: 10 }
        ]
    });

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'time_shift_zones');
    assert.ok(entry, 'time_shift_zones should be registered');
    assert.equal(entry!.currentActive, 2);
    assert.ok(entry!.currentActive <= entry!.maxActive);
});

test('wind_currents: syncs to the summed per-zone instance total', () => {
    const scene = new THREE.Scene();
    const sys = new WindCurrentsSystem(scene);
    sys.activate({
        zones: [
            { x: 400, y: 5, width: 200, height: 20, forceX: 0, forceY: 30 },
            { x: 700, y: 5, width: 200, height: 20, forceX: 0, forceY: -30 }
        ]
    });

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'wind_currents');
    assert.ok(entry, 'wind_currents should be registered');
    // Math.max(10, floor(200*20/10)) = 400 per zone, matching level 2's config.
    assert.equal(entry!.currentActive, 800);
    assert.ok(entry!.currentActive <= entry!.maxActive);
});

test('singing_geodes: syncs to the density-driven count, not pool maxCount', () => {
    const scene = new THREE.Scene();
    const sys = new SingingGeodeSystem(scene, null, null);
    sys.activate(20);

    const entry = decorationBudget.getSnapshot().find((e) => e.id === 'singing_geodes');
    assert.ok(entry, 'singing_geodes should be registered');
    assert.equal(entry!.currentActive, 20);
    assert.ok(entry!.currentActive <= entry!.maxActive);

    sys.deactivate();
    const after = decorationBudget.getSnapshot().find((e) => e.id === 'singing_geodes');
    assert.equal(after!.currentActive, 0);
});
