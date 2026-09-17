import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ENV_SYSTEM_MANIFEST, LOAD_ONLY_ENV_FLAGS } from '../../src/level_manager/env_manifest.ts';
import { DEFERRED_ENV_FLAGS, DEFERRED_ENV_FLAG_SYSTEM_KEY } from '../../src/level_deferred_registry.ts';
import { envManifestBudgetId } from '../../src/level_manager/define_env_system.ts';
import { decorationBudget } from '../../src/decoration_budget.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('hand-written deferred env registry file must not exist', () => {
    assert.equal(
        existsSync(path.join(ROOT, 'src/level_env_registry_deferred_env.ts')),
        false,
        'DEFERRED_ENV_REGISTRY must not be re-declared beside ENV_SYSTEM_MANIFEST'
    );
});

test('env_manifest declares the same flag set as DEFERRED_ENV_FLAGS', () => {
    const manifestFlags = new Set(ENV_SYSTEM_MANIFEST.map((entry) => entry.flag));
    const declaredFlags = new Set(DEFERRED_ENV_FLAGS);

    assert.deepEqual(manifestFlags, declaredFlags);
    assert.equal(ENV_SYSTEM_MANIFEST.length, DEFERRED_ENV_FLAGS.length);
});

test('env_manifest has no duplicate flag entries', () => {
    const flags = ENV_SYSTEM_MANIFEST.map((entry) => entry.flag);
    assert.equal(flags.length, new Set(flags).size);
});

test('env_manifest systemKey per flag matches DEFERRED_ENV_FLAG_SYSTEM_KEY', () => {
    for (const entry of ENV_SYSTEM_MANIFEST) {
        assert.equal(
            entry.systemKey,
            DEFERRED_ENV_FLAG_SYSTEM_KEY[entry.flag],
            `systemKey mismatch for flag "${entry.flag}"`
        );
    }
});

test('every manifest entry has budget + descriptor metadata', () => {
    for (const entry of ENV_SYSTEM_MANIFEST) {
        assert.ok(entry.budget?.category, `missing budget.category for "${entry.flag}"`);
        assert.ok(Number.isInteger(entry.budget.instances) && entry.budget.instances >= 0);
        assert.ok(entry.label.length > 0, `empty label for "${entry.flag}"`);
        assert.ok(entry.role);
        assert.ok(entry.biomes.length > 0);
        assert.ok(entry.paletteTags.length > 0);
        assert.ok(entry.difficultyWeight >= 1 && entry.difficultyWeight <= 5);
        assert.equal(typeof entry.load, 'function');
        assert.equal(typeof entry.install, 'function');
        assert.equal(typeof entry.plugin, 'function');
    }
});

test('LOAD_ONLY_ENV_FLAGS are present in the manifest', () => {
    for (const flag of LOAD_ONLY_ENV_FLAGS) {
        const entry = ENV_SYSTEM_MANIFEST.find((e) => e.flag === flag);
        assert.ok(entry, `expected manifest entry for load-only flag "${flag}"`);
    }
});

test('install registers the manifest decoration budget', async () => {
    const entry = ENV_SYSTEM_MANIFEST.find((e) => e.flag === 'cloudCastles');
    assert.ok(entry);
    await entry.install(
        {
            scene: {},
            camera: {},
            game: {},
            installEnvPartial: () => undefined,
            assignGameSystem: () => undefined
        } as never,
        { CloudCastlesSystem: class { constructor() {} } }
    );
    const id = envManifestBudgetId('cloudCastles');
    const snap = decorationBudget.getSnapshot().find((e) => e.id === id);
    assert.ok(snap, 'manifest budget should register on install');
    assert.equal(snap!.category, entry!.budget.category);
    assert.equal(snap!.maxActive, entry!.budget.instances);
});
