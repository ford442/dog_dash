import test from 'node:test';
import assert from 'node:assert/strict';
import {
    LOST_SECTOR_FRAGMENTS,
    LOST_SECTOR_IDS,
    LOST_SECTOR_LEVEL_INDEX,
    QUANTUM_COMPASS_FRAGMENTS,
    isLostSectorId
} from '../../src/lost_sector/constants.ts';
import { LOST_SECTORS } from '../../src/lost_sector/configs.ts';
import { createLostSectorLayout } from '../../src/lost_sector/layout.ts';
import { createLostSectorRunLayout, lostSectorRunSeed, resolveLostSector } from '../../src/lost_sector/run.ts';
import { lostSectorUnlockState } from '../../src/lost_sector/unlock.ts';
import { BIOME_INSTANCE_CAP, CAMPAIGN_CHAPTER_BIOME, configManifestInstances } from '../../src/endless/catalog.ts';
import { ENDLESS_LEVEL_BASE } from '../../src/endless/constants.ts';
import { ARCHITECT_LEVEL_INDEX } from '../../src/architect/constants.ts';
import { LEVEL_CONFIG } from '../../src/level_config.ts';
import { parseRunSeed, serializeRunSeed } from '../../src/run_seed/codec.ts';
import { RUN_SEED_SCHEMA_VERSION } from '../../src/run_seed/types.ts';

test('two authored sectors, each a 1800–2500 m chapter', () => {
    assert.deepEqual([...LOST_SECTOR_IDS], ['lost-garden', 'lost-kelp']);
    for (const id of LOST_SECTOR_IDS) {
        const { config } = LOST_SECTORS[id];
        assert.ok(config.distance >= 1800 && config.distance <= 2500, `${id} distance ${config.distance}`);
        assert.ok(config.objective, `${id} has an objective`);
    }
});

test('sector slots never collide with campaign, Endless or Architect chapters', () => {
    const slots = LOST_SECTOR_IDS.map((id) => LOST_SECTOR_LEVEL_INDEX[id]);
    assert.equal(new Set(slots).size, slots.length);
    for (const slot of slots) {
        assert.ok(!(slot in LEVEL_CONFIG), `slot ${slot} is not a campaign chapter`);
        assert.ok(slot > ENDLESS_LEVEL_BASE && slot !== ARCHITECT_LEVEL_INDEX);
    }
});

test('campaign chapters 1–6 are untouched', () => {
    assert.deepEqual(Object.keys(LEVEL_CONFIG).map(Number), [1, 2, 3, 4, 5, 6]);
});

test('each sector stays under its biome campaign decoration worst case', () => {
    for (const id of LOST_SECTOR_IDS) {
        const sector = LOST_SECTORS[id];
        const instances = configManifestInstances(sector.config);
        assert.ok(instances <= BIOME_INSTANCE_CAP[sector.biome],
            `${id}: ${instances} instances > ${sector.biome} cap ${BIOME_INSTANCE_CAP[sector.biome]}`);
        assert.equal(CAMPAIGN_CHAPTER_BIOME[sector.twinChapter], sector.biome, `${id} twin chapter matches its biome`);
    }
});

test('boss gates only reuse an existing boss, and a Kraken gate is the only Kraken', () => {
    for (const id of LOST_SECTOR_IDS) {
        const { config } = LOST_SECTORS[id];
        if (!config.bossEncounter) continue;
        assert.ok(['zephyr', 'starEater', 'kraken'].includes(config.bossEncounter.kind));
        assert.ok(config.bossEncounter.triggerX > 0 && config.bossEncounter.triggerX < config.distance);
        if (config.bossEncounter.kind === 'kraken') assert.equal(config.squidSpawnRate, 0);
    }
});

test('layout is one chapter spanning 0 → distance with no next chapter', () => {
    for (const id of LOST_SECTOR_IDS) {
        const layout = createLostSectorLayout(id);
        const slot = LOST_SECTOR_LEVEL_INDEX[id];
        assert.equal(layout.mode, 'lost');
        assert.equal(layout.firstChapter, slot);
        assert.equal(layout.configs[slot], LOST_SECTORS[id].config);
        assert.deepEqual(layout.span(slot), { startX: 0, endX: LOST_SECTORS[id].config.distance, length: LOST_SECTORS[id].config.distance });
        assert.equal(layout.span(1).length, 0);
        assert.equal(layout.next(slot), null);
        assert.equal(layout.campaignTwin(slot), LOST_SECTORS[id].twinChapter);
        assert.equal(layout.progressPercent(LOST_SECTORS[id].config.distance / 2, slot), 50);
    }
});

test('run seeds round-trip through the codec and resolve to their sector', () => {
    for (const id of LOST_SECTOR_IDS) {
        const seed = lostSectorRunSeed(id, 0xdeadbeef);
        const parsed = parseRunSeed(serializeRunSeed(seed));
        assert.ok(parsed);
        assert.equal(resolveLostSector(parsed), id);
        assert.equal(parsed.rngSeed, 0xdeadbeef);
        assert.equal(createLostSectorRunLayout(parsed).firstChapter, LOST_SECTOR_LEVEL_INDEX[id]);
    }
});

test('unknown or malformed sector seeds are refused', () => {
    const base = { version: RUN_SEED_SCHEMA_VERSION, campaignId: 'lost' as const, rngSeed: 7 };
    assert.equal(resolveLostSector({ ...base, modifiers: [{ kind: 'lost_sector', sectorId: 'lost-moon' }] }), null);
    assert.equal(resolveLostSector({ ...base, modifiers: [] }), null);
    assert.equal(resolveLostSector({ ...base, campaignId: 'campaign', modifiers: [{ kind: 'lost_sector', sectorId: 'lost-kelp' }] }), null);
    assert.throws(() => createLostSectorRunLayout({ ...base, modifiers: [] }));
    assert.equal(parseRunSeed(JSON.stringify({ ...base, modifiers: [{ kind: 'lost_sector', sectorId: 42 }] })), null);
    assert.equal(isLostSectorId('lost-garden'), true);
    assert.equal(isLostSectorId('constructor'), false);
});

test('fragments unlock sectors at 3 and report compass progress toward 5', () => {
    const save = (fragments: number, compass = false) => ({
        getMapFragments: () => fragments,
        hasQuantumCompass: () => compass
    });
    assert.equal(LOST_SECTOR_FRAGMENTS, 3);
    assert.equal(QUANTUM_COMPASS_FRAGMENTS, 5);
    assert.equal(lostSectorUnlockState(save(0)).unlocked, false);
    assert.equal(lostSectorUnlockState(save(2)).unlocked, false);
    assert.equal(lostSectorUnlockState(save(3)).unlocked, true);
    const later = lostSectorUnlockState(save(5, true));
    assert.equal(later.unlocked, true);
    assert.equal(later.compassUnlocked, true);
});
