import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseArchitectSeed, serializeArchitectSeed, validateArchitectSeed } from '../../src/architect/schema.ts';
import { BRUSH_IDS, BRUSH_REGISTRY, bossKindFor, type BrushId, type BrushPlacement } from '../../src/architect/brushes.ts';
import {
    ARCHITECT_BRUSH_BUDGET,
    buildSandboxCourse,
    courseBudget,
    placementOffsets,
    sandboxLength
} from '../../src/architect/course.ts';
import { ARCHITECT_LEVEL_INDEX, ARCHITECT_MAX_PLACEMENTS, ARCHITECT_MAX_SEED_CHARS } from '../../src/architect/constants.ts';
import { architectRunSeed, resolveArchitectRun } from '../../src/architect/run.ts';
import { createArchitectLayout } from '../../src/architect/layout.ts';
import { ArchitectManager } from '../../src/architect/manager.ts';
import { configManifestInstances, isSystemEnabledIn } from '../../src/endless/catalog.ts';
import { LEVEL_CONFIG } from '../../src/level_config.ts';
import { parseRunSeed, serializeRunSeed } from '../../src/run_seed/codec.ts';
import { beginRun, getRunRngFork } from '../../src/run_seed/run_context.ts';
import type { RunSeed } from '../../src/run_seed/types.ts';

const COURSE_TEXT = readFileSync(new URL('../fixtures/architect/course.json', import.meta.url), 'utf8');

function seedOf(placements: BrushPlacement[], rngSeed = '0K3F9QA') {
    return { v: 1 as const, rngSeed, placements };
}

function mustParse(text: string) {
    const parsed = parseArchitectSeed(text);
    assert.ok(parsed.ok, parsed.ok ? '' : parsed.errors.join('; '));
    return parsed.seed;
}

class MemoryStorage {
    private data = new Map<string, string>();
    get length() { return this.data.size; }
    clear() { this.data.clear(); }
    getItem(key: string) { return this.data.get(key) ?? null; }
    key(i: number) { return [...this.data.keys()][i] ?? null; }
    removeItem(key: string) { this.data.delete(key); }
    setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

// --- Schema: untrusted seed text fails closed ------------------------------

test('the committed course seed parses and round-trips through export', () => {
    const seed = mustParse(COURSE_TEXT);
    assert.equal(seed.placements.length, 7);
    assert.deepEqual(mustParse(serializeArchitectSeed(seed)), seed);
});

test('bad seed text is refused, never thrown', () => {
    const base = JSON.parse(COURSE_TEXT);
    const cases: [string, unknown][] = [
        ['not JSON', '{oops'],
        ['not a string', 42],
        ['array root', '[]'],
        ['null root', 'null'],
        ['missing v', JSON.stringify({ ...base, v: undefined })],
        ['v 0', JSON.stringify({ ...base, v: 0 })],
        ['string v', JSON.stringify({ ...base, v: '1' })],
        ['unknown brush', JSON.stringify({ ...base, placements: [{ brushId: 'eval', density: 0.5 }] })],
        ['density > 1', JSON.stringify({ ...base, placements: [{ brushId: 'spore_field', density: 1.5 }] })],
        ['density as string', JSON.stringify({ ...base, placements: [{ brushId: 'spore_field', density: '0.5' }] })],
        ['negative x', JSON.stringify({ ...base, placements: [{ brushId: 'spore_field', density: 0.5, x: -1 }] })],
        ['x past the sandbox', JSON.stringify({ ...base, placements: [{ brushId: 'spore_field', density: 0.5, x: 801 }] })],
        ['extra placement key', JSON.stringify({ ...base, placements: [{ brushId: 'spore_field', density: 0.5, onload: 'alert(1)' }] })],
        ['extra root key', JSON.stringify({ ...base, script: 'alert(1)' })],
        ['__proto__ key', '{"v":1,"rngSeed":"1R4C6QE","placements":[],"__proto__":{"polluted":true}}'],
        ['too many placements', JSON.stringify({ ...base, placements: Array.from({ length: ARCHITECT_MAX_PLACEMENTS + 1 }, () => ({ brushId: 'spore_field', density: 0.1 })) })],
        ['seed code lower case', JSON.stringify({ ...base, rngSeed: '1r4c6qe' })],
        ['seed code too long', JSON.stringify({ ...base, rngSeed: '12345678' })],
        ['seed code over 32 bits', JSON.stringify({ ...base, rngSeed: 'ZZZZZZZ' })],
        ['seed as number', JSON.stringify({ ...base, rngSeed: 123 })],
        ['oversized text', ' '.repeat(ARCHITECT_MAX_SEED_CHARS + 1)]
    ];
    for (const [label, input] of cases) {
        const result = parseArchitectSeed(input);
        assert.equal(result.ok, false, `accepted: ${label}`);
        if (!result.ok) assert.ok(result.errors.length > 0 && result.errors.length <= 5, label);
    }
    assert.equal(({} as Record<string, unknown>).polluted, undefined, 'no prototype pollution');
});

test('a seed from a newer build fails closed with a clear reason', () => {
    const future = { ...JSON.parse(COURSE_TEXT), v: 2 };
    const result = parseArchitectSeed(JSON.stringify(future));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.errors[0], /newer version/);
});

// --- Import determinism ----------------------------------------------------

test('two imports of the same JSON build the same course and the same run streams', () => {
    const a = mustParse(COURSE_TEXT);
    const b = mustParse(COURSE_TEXT);
    assert.notEqual(a, b);
    assert.deepEqual(buildSandboxCourse(a), buildSandboxCourse(b));

    const runA = architectRunSeed(a);
    const runB = architectRunSeed(b);
    assert.deepEqual(runA, runB);
    const draws = (run: RunSeed) => {
        beginRun(run);
        return (['obstacles', 'candy', 'boss', 'environment'] as const).map((s) =>
            Array.from({ length: 16 }, () => getRunRngFork(s).random()));
    };
    assert.deepEqual(draws(runA), draws(runB));
});

test('building courses never touches LEVEL_CONFIG', () => {
    const before = structuredClone(LEVEL_CONFIG);
    for (const id of BRUSH_IDS) buildSandboxCourse(seedOf([{ brushId: id, density: 1, x: 300 }]));
    buildSandboxCourse(mustParse(COURSE_TEXT));
    assert.deepEqual(LEVEL_CONFIG, before);
});

// --- Course building ---------------------------------------------------------

test('sandbox length follows the furthest brush within 500–800 m', () => {
    assert.equal(sandboxLength([]), 500);
    assert.equal(sandboxLength([{ brushId: 'spore_field', density: 0, x: 400 }]), 550);
    assert.equal(sandboxLength([{ brushId: 'spore_field', density: 0, x: 790 }]), 800);
    assert.deepEqual(
        placementOffsets([{ brushId: 'spore_field', density: 0 }, { brushId: 'boss_gate', density: 0, x: 120 }, { brushId: 'spore_field', density: 0 }], 600),
        [200, 120, 400],
        'unpinned brushes spread evenly'
    );
});

test('every brush switches on exactly the systems it declares, and the budget counts them', () => {
    for (const id of BRUSH_IDS) {
        const course = buildSandboxCourse(seedOf([{ brushId: id, density: 0.7, x: 300 }]));
        for (const key of BRUSH_REGISTRY[id].systems) {
            assert.ok(isSystemEnabledIn(key, course.config), `${id} switches on ${key}`);
        }
        assert.equal(course.budget.instances, configManifestInstances(course.config), `${id} instance count`);
    }
    const all = buildSandboxCourse(mustParse(COURSE_TEXT));
    assert.equal(all.budget.instances, configManifestInstances(all.config));
});

test('anchored brushes land at their X and stack', () => {
    const course = buildSandboxCourse(seedOf([
        { brushId: 'wind_corridor', density: 0, x: 100 },
        { brushId: 'wind_corridor', density: 1, x: 300 },
        { brushId: 'dream_room_door', density: 0.5, x: 200 },
        { brushId: 'dream_room_door', density: 0.5, x: 400 },
        { brushId: 'boss_gate', density: 0.5, x: 450 }
    ]));
    const wind = course.config.environments?.windCurrents;
    assert.ok(wind && typeof wind === 'object');
    assert.deepEqual(wind.zones.map((z) => z.x), [100, 300]);
    assert.ok(wind.zones[0].forceY > 0 && wind.zones[1].forceY < 0, 'corridors alternate lift and dive');
    assert.deepEqual(course.config.environments?.dreamPortals?.portals.map((p) => p.x), [200, 400]);
    assert.deepEqual(course.config.bossEncounter, { kind: 'starEater', triggerX: 450 });
    assert.equal(course.config.objective?.type, 'boss');
});

test('boss density picks the boss; a boss gate beats a sling arena in either order', () => {
    assert.deepEqual([0, 0.33, 0.34, 0.66, 0.67, 1].map(bossKindFor), ['zephyr', 'zephyr', 'starEater', 'starEater', 'kraken', 'kraken']);
    const sling: BrushPlacement = { brushId: 'sling_arena', density: 0.5, x: 100 };
    const boss: BrushPlacement = { brushId: 'boss_gate', density: 1, x: 300 };
    assert.equal(buildSandboxCourse(seedOf([sling, boss])).config.objective?.type, 'boss');
    assert.equal(buildSandboxCourse(seedOf([boss, sling])).config.objective?.type, 'boss');
    assert.equal(buildSandboxCourse(seedOf([sling])).config.objective?.type, 'sling');
    assert.equal(buildSandboxCourse(seedOf([])).config.objective?.type, 'survive');
    assert.equal(buildSandboxCourse(seedOf([boss])).config.squidSpawnRate, 0, 'a Kraken gate is the only Kraken');
});

// --- Budget: over-budget courses refuse to start --------------------------

test('over-budget and rule-breaking courses list why they cannot start', () => {
    assert.deepEqual(courseBudget(mustParse(COURSE_TEXT).placements).problems, []);

    const candy = Array.from({ length: 6 }, (_, i): BrushPlacement => ({ brushId: 'candy_belt_slice', density: 0.5, x: i * 50 }));
    const pricey = courseBudget(candy);
    assert.ok(pricey.brushCost > ARCHITECT_BRUSH_BUDGET);
    assert.match(pricey.problems[0], /Brush cost/);

    const twoBosses = courseBudget([{ brushId: 'boss_gate', density: 0, x: 100 }, { brushId: 'boss_gate', density: 0, x: 300 }]);
    assert.ok(twoBosses.problems.some((p) => /Only 1 Boss Gate/.test(p)));
});

test('an over-budget run seed fails closed at run start with a HUD reason', () => {
    const candy = Array.from({ length: 6 }, (_, i): BrushPlacement => ({ brushId: 'candy_belt_slice', density: 0.5, x: i * 50 }));
    const result = resolveArchitectRun(architectRunSeed(seedOf(candy)));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /over budget/);
});

// --- Run seeds ---------------------------------------------------------------

test('architect run seeds survive the run-seed codec and resolve to the same course', () => {
    const seed = mustParse(COURSE_TEXT);
    const run = architectRunSeed(seed);
    const reparsed = parseRunSeed(serializeRunSeed(run));
    assert.ok(reparsed);
    assert.deepEqual(reparsed, run);
    const resolved = resolveArchitectRun(reparsed);
    assert.ok(resolved.ok);
    if (resolved.ok) assert.deepEqual(resolved.course, buildSandboxCourse(seed));
});

test('tampered architect run seeds pass the boot codec but fail closed in the architect chunk', () => {
    const run = architectRunSeed(mustParse(COURSE_TEXT));
    const tampered = (mutate: (raw: any) => void) => {
        const raw = JSON.parse(serializeRunSeed(run));
        mutate(raw);
        return parseRunSeed(JSON.stringify(raw));
    };
    for (const mutate of [
        (raw: any) => { raw.modifiers[0].placements[0].brushId = 'eval'; },
        (raw: any) => { raw.modifiers[0].placements[0].density = 9; },
        (raw: any) => { raw.modifiers[0].placements[0].html = '<img onerror=alert(1)>'; },
        (raw: any) => { raw.modifiers = []; },
        (raw: any) => { raw.modifiers.push({ kind: 'architect', placements: [] }); }
    ]) {
        const parsed = tampered(mutate);
        assert.ok(parsed, 'boot codec only checks shape');
        assert.equal(resolveArchitectRun(parsed).ok, false);
    }
    // Shapes the boot codec itself refuses.
    assert.equal(tampered((raw) => { raw.modifiers[0].placements = 'nope'; }), null);
    assert.equal(tampered((raw) => { raw.modifiers[0].placements = [1, 2]; }), null);
    assert.equal(tampered((raw) => {
        raw.modifiers[0].placements = Array.from({ length: ARCHITECT_MAX_PLACEMENTS + 1 }, () => ({}));
    }), null);
});

test('the sandbox layout is one chapter that ends at the course span', () => {
    const course = buildSandboxCourse(mustParse(COURSE_TEXT));
    const layout = createArchitectLayout(course);
    assert.equal(layout.mode, 'architect');
    assert.equal(layout.firstChapter, ARCHITECT_LEVEL_INDEX);
    assert.equal(layout.configs[ARCHITECT_LEVEL_INDEX], course.config);
    assert.deepEqual(layout.span(ARCHITECT_LEVEL_INDEX), { startX: 0, endX: 600, length: 600 });
    assert.equal(layout.next(ARCHITECT_LEVEL_INDEX), null);
    assert.equal(layout.campaignTwin(ARCHITECT_LEVEL_INDEX), 2);
    assert.equal(layout.progressPercent(300, ARCHITECT_LEVEL_INDEX), 50);
    assert.equal(course.config.distance, 600, 'HUD distance counts down to the finish line');
});

// --- Editor state -----------------------------------------------------------

test('ArchitectManager edits, clamps and keeps its draft across reloads', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const lab = new ArchitectManager(storage);
    assert.equal(lab.count, 0);
    assert.equal(lab.playtest().ok, false, 'an empty course cannot fly');

    const first = lab.add('wind_corridor');
    assert.ok(first.ok);
    lab.add('boss_gate');
    assert.match(lab.cannotAdd('boss_gate') ?? '', /Only 1 Boss Gate/);
    assert.equal(lab.add('boss_gate').ok, false);

    lab.setX(0, 9999);
    lab.setDensity(0, -3);
    assert.deepEqual(lab.placement(0), { brushId: 'wind_corridor', density: 0, x: 800 });

    const playtest = lab.playtest();
    assert.ok(playtest.ok);
    if (playtest.ok) assert.equal(playtest.run.campaignId, 'architect');

    const reopened = new ArchitectManager(storage);
    assert.deepEqual(reopened.seed, lab.seed, 'draft restored');
    assert.deepEqual(mustParse(reopened.exportText()), lab.seed, 'export is a valid seed');
});

test('ArchitectManager import fails closed and drops corrupt drafts', () => {
    const storage = new MemoryStorage();
    const lab = new ArchitectManager(storage as unknown as Storage);
    lab.add('spore_field');
    const before = lab.seed;
    const result = lab.importText('{"v":2,"rngSeed":"1","placements":[]}');
    assert.equal(result.ok, false);
    assert.deepEqual(lab.seed, before, 'a refused import changes nothing');

    assert.ok(lab.importText(COURSE_TEXT).ok);
    assert.deepEqual(lab.seed, mustParse(COURSE_TEXT));

    storage.setItem('dog_dash_architect_draft', '{"v":1,"rngSeed":"1","placements":[{"brushId":"rm -rf","density":1}]}');
    const fresh = new ArchitectManager(storage as unknown as Storage);
    assert.equal(fresh.count, 0, 'corrupt draft ignored');
    assert.equal(storage.getItem('dog_dash_architect_draft'), null, 'and removed');
});

test('a full course refuses more brushes', () => {
    const lab = new ArchitectManager(null);
    for (let i = 0; i < ARCHITECT_MAX_PLACEMENTS; i++) assert.ok(lab.add('sling_arena').ok);
    assert.equal(lab.add('spore_field').ok, false);
    assert.equal(lab.count, ARCHITECT_MAX_PLACEMENTS);
    assert.equal(lab.playtest().ok, false, `${ARCHITECT_MAX_PLACEMENTS} sling arenas are over the brush budget`);
});

test('every brush id in the schema has a registry row', () => {
    for (const id of BRUSH_IDS) {
        assert.equal(BRUSH_REGISTRY[id as BrushId].id, id);
        assert.ok(validateArchitectSeed(seedOf([{ brushId: id, density: 0.5 }])).ok);
    }
});
