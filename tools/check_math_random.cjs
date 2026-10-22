#!/usr/bin/env node
/**
 * Math.random() gate for seeded runs.
 *
 * Gameplay randomness — spawn counts, gap placement, drop tables, enemy
 * cadence, anything that changes what the player can hit or collect — must
 * come from the run RNG (`src/run_seed/`, see docs/DETERMINISM.md) so a seed
 * plus an input trace replays identically. Purely visual randomness
 * (sparkle, flicker, particle spread) may stay on Math.random() but must be
 * tagged on the same line:
 *
 *     const twinkle = 0.5 + Math.random() * 0.5; // visual-only
 *
 * Rules enforced here:
 *   1. Files on spawn / combat / harvest paths (GAMEPLAY_PATHS) may contain
 *      NO untagged Math.random() at all.
 *   2. Everywhere else, the count of untagged calls per file may not exceed
 *      the legacy baseline (.github/math-random-baseline.json). New files
 *      start at zero. The baseline only ratchets down:
 *          node tools/check_math_random.cjs --update
 *
 * The headless replay suite (`npm run test:replay`) is the runtime half of
 * this check: it replays chapters under two different Math.random streams
 * and fails if gameplay diverges.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(ROOT, '.github', 'math-random-baseline.json');
const TAG = '// visual-only';

/**
 * Spawn / combat / harvest paths: zero untagged Math.random() allowed.
 * Entries ending in '/' match a whole directory.
 */
const GAMEPLAY_PATHS = [
    // Sim loop, combat, spawning
    'src/main/',
    'src/sim_clock.ts',
    'src/obstacle_system/',
    'src/enemy_patterns.ts',
    'src/enemy_variants.ts',
    'src/space_robot_squid.ts',
    'src/weapons.ts',
    'src/boss_system/',
    'src/meteor_shower.ts',
    'src/asteroid_field.ts',
    'src/create_game_systems.ts',
    // Endless Dash: chapters are a pure function of the seed
    'src/endless/',
    'src/journey_layout.ts',
    // Slinging, tethers, pickups, economy
    'src/slingable_objects.ts',
    'src/sling_combo.ts',
    'src/tether_system.ts',
    'src/collectibles/',
    'src/powerup_manager/manager.ts',
    'src/powerup_manager/powerup_hooks.ts',
    'src/upgrade_system.ts',
    'src/resource_harvester.ts',
    'src/resource_inventory.ts',
    'src/data_monolith.ts',
    'src/derelict_buoy.ts',
    // Candy chapter
    'src/candy_obstacles/gummy_ring.ts',
    'src/candy_obstacles/candy_asteroid.ts',
    'src/candy_obstacles/candy_belt_manager.ts',
    'src/candy_materials/gameplay.ts',
    'src/combo_corridor.ts',
    'src/combo_corridor_rng.ts',
    // Creatures and friends
    'src/creature_manager.ts',
    'src/crystal_tarsier_guardian.ts',
    'src/space_friends/',
    'src/butterfly_swarm.ts',
    'src/moon_snail.ts',
    'src/puff_puffer.ts',
    'src/starlight_koi.ts',
    'src/void_jellyfish.ts',
    'src/fossilized_space_whales.ts',
    'src/dream_portal/',
    // Level streaming, geology, interactive flora and world layout
    'src/level_manager/',
    'src/geological/',
    'src/singing_geodes.ts',
    'src/storm_geodes.ts',
    'src/pinwheel_flora.ts',
    'src/solar_sail_ferns.ts',
    'src/crystal_chimes.ts',
    'src/wind_chimes.ts',
    'src/flower_constellations/manager.ts',
    'src/industrial_geometry.ts',
    'src/environment.ts',
    'src/space_garden.ts',
    'src/sky_rail_terminal.ts',
    'src/wind_currents.ts',
    'src/depth_layers.ts',
    'src/void_root_ball.ts',
];

// Calls *and* bare references: `fn(Math.random)` hands the global stream to
// code that never names it (e.g. magmaGlobCount(Math.random) once decided
// glob counts), so both count.
const CALL = /\bMath\.random\b/g;

function listSourceFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listSourceFiles(full));
        else if (/\.(ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
    }
    return out;
}

/** Strip // line comments and /* block comments *\/ that are not the tag, so commented-out calls don't count. */
function codeOnly(line, inBlock) {
    let code = '';
    let i = 0;
    let block = inBlock;
    while (i < line.length) {
        if (block) {
            const end = line.indexOf('*/', i);
            if (end < 0) return { code, block: true };
            i = end + 2;
            block = false;
            continue;
        }
        const lc = line.indexOf('//', i);
        const bc = line.indexOf('/*', i);
        if (lc >= 0 && (bc < 0 || lc < bc)) {
            code += line.slice(i, lc);
            return { code, block: false };
        }
        if (bc >= 0) {
            code += line.slice(i, bc);
            i = bc + 2;
            block = true;
            continue;
        }
        code += line.slice(i);
        break;
    }
    return { code, block };
}

/** Untagged Math.random() calls per repo-relative file, with line numbers. */
function scan() {
    const result = {};
    for (const file of listSourceFiles(SRC)) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        let inBlock = false;
        const hits = [];
        lines.forEach((line, idx) => {
            const { code, block } = codeOnly(line, inBlock);
            inBlock = block;
            const calls = (code.match(CALL) || []).length;
            if (calls > 0 && !line.includes(TAG)) {
                for (let n = 0; n < calls; n++) hits.push(idx + 1);
            }
        });
        if (hits.length > 0) result[rel] = hits;
    }
    return result;
}

function isGameplayPath(rel) {
    return GAMEPLAY_PATHS.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
}

function readBaseline() {
    if (!fs.existsSync(BASELINE_PATH)) return {};
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).files || {};
}

function writeBaseline(found) {
    const files = {};
    for (const rel of Object.keys(found).sort()) {
        if (!isGameplayPath(rel)) files[rel] = found[rel].length;
    }
    const total = Object.values(files).reduce((a, b) => a + b, 0);
    const doc = {
        _comment: 'Legacy untagged Math.random() calls per file (visual systems not yet audited). Ratchet down only: node tools/check_math_random.cjs --update. See docs/DETERMINISM.md.',
        total,
        files,
    };
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    return total;
}

/** Returns a list of human-readable violations (empty when clean). */
function check() {
    const found = scan();
    const baseline = readBaseline();
    const violations = [];
    const shrunk = [];
    for (const [rel, lines] of Object.entries(found)) {
        if (isGameplayPath(rel)) {
            violations.push(`${rel}: ${lines.length} untagged Math.random() on a gameplay path (lines ${lines.join(', ')}). Use the run RNG (gameplayRandom) or tag a purely visual call "${TAG}".`);
            continue;
        }
        const allowed = baseline[rel] || 0;
        if (lines.length > allowed) {
            violations.push(`${rel}: ${lines.length} untagged Math.random() (baseline ${allowed}; lines ${lines.join(', ')}). New randomness must use the run RNG or carry "${TAG}".`);
        }
    }
    for (const [rel, allowed] of Object.entries(baseline)) {
        const now = (found[rel] || []).length;
        if (now < allowed) shrunk.push(`${rel}: ${allowed} -> ${now}`);
    }
    return { violations, shrunk };
}

module.exports = { scan, check, isGameplayPath, GAMEPLAY_PATHS, TAG, BASELINE_PATH };

if (require.main === module) {
    if (process.argv.includes('--update')) {
        const found = scan();
        const bad = Object.keys(found).filter(isGameplayPath);
        if (bad.length > 0) {
            console.error('Refusing to baseline gameplay-path files (fix them instead):\n  ' + bad.join('\n  '));
            process.exit(1);
        }
        const total = writeBaseline(found);
        console.log(`Math.random baseline updated: ${total} legacy untagged calls.`);
        process.exit(0);
    }
    const { violations, shrunk } = check();
    if (shrunk.length > 0) {
        console.log('Baseline can ratchet down (run with --update):\n  ' + shrunk.join('\n  '));
    }
    if (violations.length > 0) {
        console.error('Math.random gate failed:\n  ' + violations.join('\n  '));
        process.exit(1);
    }
    console.log('Math.random gate: OK');
}
