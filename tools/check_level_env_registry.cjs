#!/usr/bin/env node
/**
 * Validates the level environment registry closed loop:
 * - Every LevelEnvironments key is classified deferred or eager
 * - DEFERRED_ENV_REGISTRY keys match DEFERRED_ENV_FLAGS
 * - PLUGIN_ORDER covers every flag that needs activate/deactivate (except load-only flags)
 * - LEVEL_CONFIG enabled deferred flags resolve to registry entries
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function parseStringArray(source, constName) {
    const re = new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\] as const`);
    const match = source.match(re);
    if (!match) throw new Error(`Could not parse ${constName}`);
    return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function parseRegistryKeys(source) {
    const match = source.match(/export const DEFERRED_ENV_REGISTRY[^=]*=\s*\{([\s\S]*?)\n\};/);
    if (!match) throw new Error('Could not parse DEFERRED_ENV_REGISTRY');
    return [...match[1].matchAll(/^\s+([a-zA-Z0-9_]+):\s*\{/gm)].map((m) => m[1]);
}

function parseLevelEnvTypeKeys(source) {
    const match = source.match(/export type LevelEnvironments = \{([\s\S]*?)\n\};/);
    if (!match) throw new Error('Could not parse LevelEnvironments type');
    return [...match[1].matchAll(/^\s+([a-zA-Z0-9_]+)\??:/gm)].map((m) => m[1]);
}

function parsePluginOrder(source) {
    const match = source.match(/const PLUGIN_ORDER = \[([\s\S]*?)\] as const/);
    if (!match) throw new Error('Could not parse PLUGIN_ORDER');
    return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function parseEnabledDeferredFlagsInLevels(levelConfigSource, deferredFlags) {
    const enabled = new Set();
    for (const flag of deferredFlags) {
        const re = new RegExp(`\\b${flag}\\s*:`);
        if (re.test(levelConfigSource)) enabled.add(flag);
    }
    return enabled;
}

function fail(msg) {
    console.error(`level_env_registry check FAILED: ${msg}`);
    process.exit(1);
}

function main() {
    const deferredSrc = read('src/level_deferred_registry.ts');
    const registrySrc = read('src/level_env_registry.ts');
    const pluginsSrc = read('src/level_manager/environment_plugins.ts');
    const levelConfigSrc = read('src/level_config.ts');

    const deferredFlags = parseStringArray(deferredSrc, 'DEFERRED_ENV_FLAGS');
    const eagerFlags = parseStringArray(deferredSrc, 'EAGER_ENV_FLAGS');
    const registryKeys = parseRegistryKeys(registrySrc);
    const envTypeKeys = parseLevelEnvTypeKeys(levelConfigSrc);
    const pluginOrder = parsePluginOrder(pluginsSrc);

    const classified = new Set([...deferredFlags, ...eagerFlags]);
    const missingClassification = envTypeKeys.filter((k) => !classified.has(k));
    if (missingClassification.length) {
        fail(`LevelEnvironments keys missing from DEFERRED_ENV_FLAGS / EAGER_ENV_FLAGS: ${missingClassification.join(', ')}`);
    }

    const extraClassification = [...classified].filter((k) => !envTypeKeys.includes(k));
    if (extraClassification.length) {
        fail(`Registry classifies unknown env flags: ${extraClassification.join(', ')}`);
    }

    const missingRegistry = deferredFlags.filter((f) => !registryKeys.includes(f));
    if (missingRegistry.length) {
        fail(`DEFERRED_ENV_FLAGS without DEFERRED_ENV_REGISTRY entry: ${missingRegistry.join(', ')}`);
    }

    const extraRegistry = registryKeys.filter((f) => !deferredFlags.includes(f));
    if (extraRegistry.length) {
        fail(`DEFERRED_ENV_REGISTRY keys not in DEFERRED_ENV_FLAGS: ${extraRegistry.join(', ')}`);
    }

    // dreamPortals / aquaticLife load via registry but have no level plugin wiring.
    const loadOnlyFlags = new Set(['dreamPortals', 'aquaticLife']);
    const flagsNeedingPlugins = envTypeKeys.filter((f) => !loadOnlyFlags.has(f));
    const missingPlugins = flagsNeedingPlugins.filter((f) => !pluginOrder.includes(f));
    if (missingPlugins.length) {
        fail(`PLUGIN_ORDER missing flags: ${missingPlugins.join(', ')}`);
    }

    const enabledInLevels = parseEnabledDeferredFlagsInLevels(levelConfigSrc, deferredFlags);
    for (const flag of enabledInLevels) {
        if (!registryKeys.includes(flag)) {
            fail(`Level config enables deferred flag "${flag}" with no registry loader`);
        }
    }

    console.log(
        `level_env_registry check OK — ${deferredFlags.length} deferred, ${eagerFlags.length} eager, ${pluginOrder.length} plugins, ${enabledInLevels.size} deferred flags used in levels`
    );
}

main();
