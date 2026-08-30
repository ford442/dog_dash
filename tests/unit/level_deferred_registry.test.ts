import test from 'node:test';
import assert from 'node:assert/strict';
import { systemsNeededForLevel } from '../../src/level_deferred_registry.ts';
import { isEnvironmentEnabled } from '../../src/level_manager/types.ts';
import type { LevelConfig } from '../../src/level_config.ts';

test('isEnvironmentEnabled handles boolean and object configs', () => {
    assert.equal(isEnvironmentEnabled(true), true);
    assert.equal(isEnvironmentEnabled(false), false);
    assert.equal(isEnvironmentEnabled({ enabled: false }), false);
    assert.equal(isEnvironmentEnabled({ enabled: true }), true);
    assert.equal(isEnvironmentEnabled({ rate: 0.5 }), true);
});

test('systemsNeededForLevel returns empty for undefined config', () => {
    assert.deepEqual(systemsNeededForLevel(undefined), []);
});

test('systemsNeededForLevel includes boss when objective is boss', () => {
    const cfg = { objective: { type: 'boss' } } as LevelConfig;
    const keys = systemsNeededForLevel(cfg);
    assert.ok(keys.includes('boss'));
});

test('systemsNeededForLevel includes deferred env flags when enabled', () => {
    const cfg = {
        environments: { waterfall: true, nebula: false }
    } as LevelConfig;
    const keys = systemsNeededForLevel(cfg);
    assert.ok(keys.includes('waterfall'));
    assert.ok(!keys.includes('nebula'));
});

test('systemsNeededForLevel includes starlightKoi for biological levels with density', () => {
    const cfg = {
        environments: { biological: true },
        koiSchoolDensity: 0.4
    } as LevelConfig;
    assert.ok(systemsNeededForLevel(cfg).includes('starlightKoi'));
});

test('systemsNeededForLevel always includes magicPaintbrush', () => {
    const keys = systemsNeededForLevel({} as LevelConfig);
    assert.ok(keys.includes('magicPaintbrush'));
});

test('candyField env flag maps to candyPlanetRing system key', () => {
    const cfg = { environments: { candyField: true } } as LevelConfig;
    const keys = systemsNeededForLevel(cfg);
    assert.ok(keys.includes('candyPlanetRing'));
    assert.ok(!keys.includes('candyField'));
});
