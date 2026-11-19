import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EXTRACT_YIELDS,
    EXTRACT_UNITS_PER_SEC,
    fullExtractYield,
    tickExtract
} from '../../src/extractor/yields.ts';
import {
    ExtractorBeam,
    pickExtractTarget,
    EXTRACT_RANGE,
    type ExtractCandidate
} from '../../src/extractor/beam.ts';
import { rollMaterialDrops } from '../../src/resource_inventory.ts';
import { beginRun } from '../../src/run_seed/run_context.ts';
import { RUN_SEED_SCHEMA_VERSION } from '../../src/run_seed/types.ts';

const DT = 1 / 60;

test('grant table: jelly-moss siphons to 5 Pure Extract over 10 s (plan.md §V)', () => {
    const moss = EXTRACT_YIELDS.nebulaJellyMoss;
    assert.equal(moss.material, 'pureExtract');
    assert.equal(EXTRACT_UNITS_PER_SEC, 10);
    assert.equal(moss.capacity / EXTRACT_UNITS_PER_SEC, 10);
    assert.equal(fullExtractYield('nebulaJellyMoss'), 5);
    // Kid-tuned drain: well under the plan's 50% shields, and energy only.
    assert.ok(moss.energyPerSec * 10 <= 50);
});

test('grant table: every species yields whole materials and never Tainted Extract', () => {
    for (const [species, y] of Object.entries(EXTRACT_YIELDS)) {
        assert.ok(y.capacity % y.unitsPerGrant === 0, `${species} capacity divides evenly`);
        assert.notEqual(y.material, 'taintedExtract');
        assert.ok(fullExtractYield(species as keyof typeof EXTRACT_YIELDS) >= 1);
    }
});

test('tickExtract banks exactly the full yield regardless of step size', () => {
    for (const species of Object.keys(EXTRACT_YIELDS) as (keyof typeof EXTRACT_YIELDS)[]) {
        for (const dt of [1 / 30, 1 / 60, 1 / 144, 0.37]) {
            let drawn = 0;
            let granted = 0;
            let depleted = false;
            for (let i = 0; i < 100000 && !depleted; i++) {
                const t = tickExtract(species, drawn, dt);
                drawn = t.drawn;
                granted += t.granted;
                depleted = t.depleted;
            }
            assert.ok(depleted);
            assert.equal(granted, fullExtractYield(species), `${species} @ dt=${dt}`);
        }
    }
});

function moss(x: number, y: number, z = 0): ExtractCandidate<{ id: string }> {
    return { ref: { id: `moss@${x},${y}` }, species: 'nebulaJellyMoss', x, y, z };
}

test('cone picker: nearest forward target in range; ignores behind, far and background', () => {
    const near = moss(8, 1);
    const far = moss(15, 0);
    const behind = moss(-4, 0);
    const outOfRange = moss(EXTRACT_RANGE + 1, 0);
    const steep = moss(3, 12);
    const background = moss(6, 0, -30);
    const pick = pickExtractTarget(0, 0, 0, [far, behind, outOfRange, steep, background, near]);
    assert.equal(pick, near);
    assert.equal(pickExtractTarget(0, 0, 0, [behind, outOfRange, steep, background]), null);
});

test('hold on a moss → bag gains Pure Extract, moss survives, energy drops', () => {
    const beam = new ExtractorBeam<{ id: string }>();
    const target = moss(6, 0);
    let energy = 100;
    let pure = 0;
    let steps = 0;
    let depleted = false;
    while (!depleted && steps < 60 * 15) {
        const r = beam.step({ dt: DT, held: true, energy, shipX: 0, shipY: 0, shipZ: 0, candidates: [target] });
        energy -= r.energyDrain;
        if (r.material === 'pureExtract') pure += r.granted;
        depleted = r.depleted;
        steps++;
        if (!depleted) assert.ok(beam.isRooted(), 'locked target roots the ship');
    }
    assert.equal(pure, 5);
    assert.ok(Math.abs(steps * DT - 10) < 0.05, `~10 s siphon (${steps * DT})`);
    assert.ok(energy < 100 && energy >= 65, `energy drained (${energy})`);
    assert.ok(beam.isSpent(target.ref), 'spent, not destroyed');

    // A spent moss can't be siphoned again.
    const again = beam.step({ dt: DT, held: true, energy, shipX: 0, shipY: 0, shipZ: 0, candidates: [target] });
    assert.equal(again.target, null);
    assert.equal(again.beaming, true);
    assert.equal(beam.isRooted(), false);
});

test('beam: releasing un-roots; partial progress is kept; no energy → no beam', () => {
    const beam = new ExtractorBeam<{ id: string }>();
    const target = moss(5, 0);
    const base = { dt: DT, energy: 50, shipX: 0, shipY: 0, shipZ: 0, candidates: [target] };
    for (let i = 0; i < 120; i++) beam.step({ ...base, held: true });
    const half = beam.progressOf(target.ref, 'nebulaJellyMoss');
    assert.ok(half > 0.15 && half < 0.25);

    const off = beam.step({ ...base, held: false });
    assert.equal(off.beaming, false);
    assert.equal(beam.isRooted(), false);
    assert.equal(beam.progressOf(target.ref, 'nebulaJellyMoss'), half);

    const dry = beam.step({ ...base, held: true, energy: 0 });
    assert.equal(dry.outOfEnergy, true);
    assert.equal(dry.target, null);
    assert.equal(beam.isBeaming(), false);
});

test('beam lock is sticky: a closer moss drifting in does not steal a half-done siphon', () => {
    const beam = new ExtractorBeam<{ id: string }>();
    const first = moss(12, 0);
    const closer = moss(4, 0);
    const base = { dt: DT, held: true, energy: 100, shipX: 0, shipY: 0, shipZ: 0 };
    beam.step({ ...base, candidates: [first] });
    const r = beam.step({ ...base, candidates: [closer, first] });
    assert.equal(r.target?.ref, first.ref);
});

test('destroy path still grants the existing jelly-moss drop table', () => {
    beginRun({ version: RUN_SEED_SCHEMA_VERSION, campaignId: 'campaign', rngSeed: 4242, modifiers: [] });
    const tainted = rollMaterialDrops('nebulaJellyMoss', 'destroy', { precision: false });
    const pure = rollMaterialDrops('nebulaJellyMoss', 'destroy', { precision: true });
    assert.ok(tainted.some((g) => g.id === 'taintedExtract'));
    assert.ok(!tainted.some((g) => g.id === 'pureExtract'));
    assert.ok(pure.some((g) => g.id === 'pureExtract'));
    // The new 'extract' event has no drop table — the beam uses EXTRACT_YIELDS.
    assert.deepEqual(rollMaterialDrops('nebulaJellyMoss', 'extract'), []);
});
