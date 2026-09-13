import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ENV_SYSTEM_MANIFEST, LOAD_ONLY_ENV_FLAGS } from '../../src/level_manager/env_manifest.ts';
import { DEFERRED_ENV_FLAGS, DEFERRED_ENV_FLAG_SYSTEM_KEY } from '../../src/level_deferred_registry.ts';

/**
 * Phase 1 of the env-system-registration RFC: `env_manifest.ts` is a
 * parallel, additive structure — nothing imports it at runtime yet. This is
 * the "manifest-derived data equals the hand-written registry data"
 * assertion the RFC calls for, kept as a unit test (not a runtime assertion
 * in `main/startup.ts` or the render loop) because:
 *   - it needs no live GameContext / THREE scene — it only compares the
 *     static shape (flags, systemKeys, declared order) of two structures;
 *   - a module-init assertion would run on every page load for a check
 *     that only matters when someone edits one of these files, which is
 *     exactly what CI (`npm run check` -> `npm run test:unit`) already
 *     gates on every PR;
 *   - `tools/check_level_env_registry.cjs` already regex-parses source for
 *     a related (but distinct) closed-loop check without importing the
 *     modules — this test complements it with a stricter, manifest-specific
 *     comparison.
 *
 * NOTE on why `level_env_registry.ts` itself is read as text instead of
 * imported: it has a real (non-type) top-level import of `./environment`,
 * which imports `./scene_context`, which calls `document.querySelector` and
 * constructs a live `THREE.Scene`/camera/lights at module scope. That graph
 * requires a browser and cannot load under `node --test`. This is the same
 * reason `tools/check_level_env_registry.cjs` parses that file as text
 * rather than requiring it — we follow the same approach here for the one
 * piece of data (`DEFERRED_ENV_PLUGIN_ORDER` + per-entry `systemKey`) that
 * only lives in that file. `env_manifest.ts` avoids the problem entirely by
 * only ever `import type`-ing from `level_env_registry.ts`.
 */

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const registrySource = readFileSync(path.join(ROOT, 'src/level_env_registry.ts'), 'utf8');
const deferredEnvRegistrySource = readFileSync(path.join(ROOT, 'src/level_env_registry_deferred_env.ts'), 'utf8');
const registryDeferredEnvSource = readFileSync(path.join(ROOT, 'src/level_env_registry_deferred_env.ts'), 'utf8');

function parseDeferredEnvPluginOrder(source: string): string[] {
    const match = source.match(/export const DEFERRED_ENV_PLUGIN_ORDER[^=]*=\s*\[([\s\S]*?)\];/);
    if (!match) throw new Error('Could not parse DEFERRED_ENV_PLUGIN_ORDER');
    return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function parseRegistrySystemKeys(source: string): Map<string, string> {
    const match = source.match(/export const DEFERRED_ENV_REGISTRY[^=]*=\s*\{([\s\S]*?)\n\};/);
    if (!match) throw new Error('Could not parse DEFERRED_ENV_REGISTRY');
    const body = match[1];
    const entries = new Map<string, string>();
    for (const m of body.matchAll(/\n {4}(\w+): \{\n(?: {8}.*\n)*? {8}systemKey: '([^']+)'/g)) {
        entries.set(m[1], m[2]);
    }
    return entries;
}

const DEFERRED_ENV_PLUGIN_ORDER = parseDeferredEnvPluginOrder(registrySource);
const REGISTRY_SYSTEM_KEYS = parseRegistrySystemKeys(deferredEnvRegistrySource);

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

test('env_manifest systemKey per flag matches DEFERRED_ENV_REGISTRY (source-parsed)', () => {
    assert.ok(REGISTRY_SYSTEM_KEYS.size > 0, 'expected to parse at least one DEFERRED_ENV_REGISTRY entry');
    for (const entry of ENV_SYSTEM_MANIFEST) {
        assert.equal(
            entry.systemKey,
            REGISTRY_SYSTEM_KEYS.get(entry.flag),
            `systemKey mismatch vs DEFERRED_ENV_REGISTRY for flag "${entry.flag}"`
        );
    }
});

test('env_manifest declaration order (minus load-only flags) matches DEFERRED_ENV_PLUGIN_ORDER', () => {
    assert.ok(DEFERRED_ENV_PLUGIN_ORDER.length > 0, 'expected to parse a non-empty DEFERRED_ENV_PLUGIN_ORDER');
    const loadOnly = new Set<string>(LOAD_ONLY_ENV_FLAGS);
    const manifestOrder = ENV_SYSTEM_MANIFEST.filter((entry) => !loadOnly.has(entry.flag)).map((entry) => entry.flag);
    assert.deepEqual(manifestOrder, DEFERRED_ENV_PLUGIN_ORDER);
});

test('LOAD_ONLY_ENV_FLAGS are present in the manifest', () => {
    for (const flag of LOAD_ONLY_ENV_FLAGS) {
        const entry = ENV_SYSTEM_MANIFEST.find((e) => e.flag === flag);
        assert.ok(entry, `expected manifest entry for load-only flag "${flag}"`);
    }
});
