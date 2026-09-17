import test from 'node:test';
import assert from 'node:assert/strict';
import {
    pickKelpConfig,
    kelpDrainPerSec,
    kelpSpeedMultiplier,
    applyEnergyDrain,
    regenEnergy,
    hexNeedleOffsets,
    applyCryoHit,
    cryoSpeedMultiplier,
    meltProgress,
    magmaCycleAt,
    magmaGlobDirections,
    KELP_MIN_NODES,
    KELP_MAX_NODES,
    CRYO_MAX_STACKS
} from '../../src/geological/flora_gameplay.ts';

test('kelp config is 5–8 nodes without inline Math.random in the picker', () => {
    let i = 0;
    const seq = [0, 0.99, 0.4, 0.1];
    const cfg = pickKelpConfig(() => seq[i++] ?? 0);
    assert.ok(cfg.nodes >= KELP_MIN_NODES && cfg.nodes <= KELP_MAX_NODES);
    assert.ok(cfg.length > 0);
    assert.equal(pickKelpConfig(() => 0).nodes, KELP_MIN_NODES);
    assert.equal(pickKelpConfig(() => 0.999).nodes, KELP_MAX_NODES);
});

test('kelp drain doubles per consecutive second and caps at 12', () => {
    assert.equal(kelpDrainPerSec(0), 3);
    assert.equal(kelpDrainPerSec(1), 6);
    assert.equal(kelpDrainPerSec(2), 12);
    assert.equal(kelpDrainPerSec(8), 12);
    assert.equal(kelpSpeedMultiplier(true), 0.3);
    assert.equal(kelpSpeedMultiplier(false), 1);
    assert.equal(applyEnergyDrain(100, 12, 1), 88);
    assert.ok(regenEnergy(50, 100, 1) > 50);
});

test('ice needles occupy a hexagonal lattice away from the origin', () => {
    const offsets = hexNeedleOffsets(19, 5);
    assert.equal(offsets.length, 19);
    const unique = new Set(offsets.map((o) => `${o.x.toFixed(2)},${o.z.toFixed(2)}`));
    assert.equal(unique.size, 19);
    const away = offsets.filter((o) => Math.hypot(o.x, o.z) > 0.5);
    assert.ok(away.length >= 12);
});

test('cryo stacks cap at 3 and melt completes in 2s of boost', () => {
    let stacks = 0;
    stacks = applyCryoHit(stacks);
    stacks = applyCryoHit(stacks);
    stacks = applyCryoHit(stacks);
    stacks = applyCryoHit(stacks);
    assert.equal(stacks, CRYO_MAX_STACKS);
    assert.ok(cryoSpeedMultiplier(3) < 1);
    assert.equal(meltProgress(0, 2, true), 1);
    assert.ok(meltProgress(0.5, 0.1, false) < 0.5);
});

test('magma cycle has a readable telegraph then a harvestable cooldown', () => {
    assert.equal(magmaCycleAt(1).phase, 'build');
    const crit = magmaCycleAt(12.5);
    assert.equal(crit.phase, 'critical');
    assert.equal(crit.telegraph, true);
    assert.equal(magmaCycleAt(17.2).phase, 'eruption');
    const cool = magmaCycleAt(20);
    assert.equal(cool.phase, 'cooldown');
    assert.equal(cool.telegraph, false);
    assert.equal(magmaGlobDirections(8).length, 8);
});
