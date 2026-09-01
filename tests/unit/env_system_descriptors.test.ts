import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ENV_SYSTEM_DESCRIPTORS,
    allEnvSystemDescriptors,
    envSystemsForBiome,
    envSystemsForRole,
    envSystemsForRoleInBiome,
    type Biome,
    type EnvRole
} from '../../src/env_system_descriptors.ts';
import {
    DEFERRED_ENV_FLAGS,
    DEFERRED_LEVEL_SYSTEM_KEYS
} from '../../src/level_deferred_registry.ts';

const BIOMES: Biome[] = ['nebula', 'industrial', 'biological', 'crystalline', 'candy'];
const ROLES: EnvRole[] = ['backdrop', 'traversal', 'hazard', 'flavor', 'boss'];

test('every DEFERRED_ENV_FLAGS entry has a descriptor', () => {
    for (const flag of DEFERRED_ENV_FLAGS) {
        assert.ok(ENV_SYSTEM_DESCRIPTORS[flag], `missing descriptor for env flag "${flag}"`);
    }
});

test('every DEFERRED_LEVEL_SYSTEM_KEYS entry has a descriptor', () => {
    for (const key of DEFERRED_LEVEL_SYSTEM_KEYS) {
        assert.ok(ENV_SYSTEM_DESCRIPTORS[key], `missing descriptor for level system key "${key}"`);
    }
});

test('descriptor table has no keys outside the known registries + eager butterflySwarm', () => {
    const known = new Set<string>([...DEFERRED_ENV_FLAGS, ...DEFERRED_LEVEL_SYSTEM_KEYS, 'butterflySwarm']);
    for (const key of Object.keys(ENV_SYSTEM_DESCRIPTORS)) {
        assert.ok(known.has(key), `descriptor "${key}" does not correspond to any registered system`);
    }
    assert.equal(Object.keys(ENV_SYSTEM_DESCRIPTORS).length, known.size);
});

test('every descriptor has well-formed fields', () => {
    for (const d of allEnvSystemDescriptors()) {
        assert.equal(d.key, d.key, `descriptor key mismatch for "${d.label}"`);
        assert.ok(d.label.length > 0, `empty label for "${d.key}"`);
        assert.ok(ROLES.includes(d.role), `invalid role "${d.role}" for "${d.key}"`);
        assert.ok(d.biomes.length > 0, `"${d.key}" declares no biome affinity`);
        for (const b of d.biomes) {
            assert.ok(BIOMES.includes(b), `invalid biome "${b}" for "${d.key}"`);
        }
        assert.ok(d.paletteTags.length > 0, `"${d.key}" declares no palette tags`);
        assert.ok(
            Number.isInteger(d.difficultyWeight) && d.difficultyWeight >= 1 && d.difficultyWeight <= 5,
            `difficultyWeight out of range for "${d.key}"`
        );
    }
});

test('every registered system is reachable by at least one (role, biome) combination', () => {
    const reachable = new Set<string>();
    for (const role of ROLES) {
        for (const biome of BIOMES) {
            for (const d of envSystemsForRoleInBiome(role, biome)) {
                reachable.add(d.key);
            }
        }
    }
    const all = new Set(Object.keys(ENV_SYSTEM_DESCRIPTORS));
    for (const key of all) {
        assert.ok(reachable.has(key), `"${key}" is unreachable by any (role, biome) recipe query`);
    }
});

test('envSystemsForBiome / envSystemsForRole filter correctly', () => {
    const nebulaSystems = envSystemsForBiome('nebula');
    assert.ok(nebulaSystems.every((d) => d.biomes.includes('nebula')));
    assert.ok(nebulaSystems.some((d) => d.key === 'blackHole'));

    const hazards = envSystemsForRole('hazard');
    assert.ok(hazards.every((d) => d.role === 'hazard'));
    assert.ok(hazards.some((d) => d.key === 'asteroidField'));

    const boss = envSystemsForRole('boss');
    assert.deepEqual(boss.map((d) => d.key), ['boss']);
});

test('every biome has at least one backdrop, one traversal, and one hazard system', () => {
    for (const biome of BIOMES) {
        assert.ok(envSystemsForRoleInBiome('backdrop', biome).length > 0, `no backdrop for ${biome}`);
        assert.ok(envSystemsForRoleInBiome('traversal', biome).length > 0, `no traversal for ${biome}`);
        assert.ok(envSystemsForRoleInBiome('hazard', biome).length > 0, `no hazard for ${biome}`);
    }
});
