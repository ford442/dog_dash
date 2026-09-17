#!/usr/bin/env node
/**
 * Validates the level environment registry closed loop:
 * - Every LevelEnvironments key is classified deferred or eager
 * - ENV_SYSTEM_MANIFEST flags match DEFERRED_ENV_FLAGS
 * - PLUGIN_ORDER covers every flag that needs activate/deactivate (except load-only flags)
 * - LEVEL_CONFIG enabled deferred flags resolve to manifest entries
 * - Each defineEnvSystem spec includes budget + descriptor metadata
 * - Hand-written DEFERRED_ENV_REGISTRY file must not exist
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

function parseManifestFlags(source) {
    const match = source.match(/export const ENV_SYSTEM_MANIFEST = \[([\s\S]*?)\] as const/);
    if (!match) throw new Error('Could not parse ENV_SYSTEM_MANIFEST');
    return [...match[1].matchAll(/^\s+([a-zA-Z0-9_]+),?\s*$/gm)].map((m) => m[1]);
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
    if (fs.existsSync(path.join(ROOT, 'src/level_env_registry_deferred_env.ts'))) {
        fail('src/level_env_registry_deferred_env.ts must not exist — deferred env systems load from ENV_SYSTEM_MANIFEST');
    }

    const deferredSrc = read('src/level_deferred_registry.ts');
    const manifestSrc = read('src/level_manager/env_manifest.ts');
    const pluginsSrc = read('src/level_manager/environment_plugins.ts');
    const levelConfigSrc = read('src/level_config.ts');

    const deferredFlags = parseStringArray(deferredSrc, 'DEFERRED_ENV_FLAGS');
    const eagerFlags = parseStringArray(deferredSrc, 'EAGER_ENV_FLAGS');
    const manifestFlags = parseManifestFlags(manifestSrc);
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

    const missingManifest = deferredFlags.filter((f) => !manifestFlags.includes(f));
    if (missingManifest.length) {
        fail(`DEFERRED_ENV_FLAGS without ENV_SYSTEM_MANIFEST entry: ${missingManifest.join(', ')}`);
    }

    const extraManifest = manifestFlags.filter((f) => !deferredFlags.includes(f));
    if (extraManifest.length) {
        fail(`ENV_SYSTEM_MANIFEST flags not in DEFERRED_ENV_FLAGS: ${extraManifest.join(', ')}`);
    }

    const defineBlocks = [];
    for (const flag of manifestFlags) {
        const needle = 'defineEnvSystem<' + "'" + flag + "'" + '>({';
        const start = manifestSrc.indexOf(needle);
        if (start < 0) {
            fail('missing defineEnvSystem block for ' + flag);
        }
        const bodyStart = start + needle.length;
        const end = manifestSrc.indexOf('\n});', bodyStart);
        if (end < 0) {
            fail('unclosed defineEnvSystem for ' + flag);
        }
        defineBlocks.push([flag, manifestSrc.slice(bodyStart, end)]);
    }
    const requiredFields = ['budget:', 'label:', 'role:', 'biomes:', 'paletteTags:', 'difficultyWeight:', 'load:', 'install:', 'activate:', 'deactivate:'];
    for (const [flag, body] of defineBlocks) {
        for (const field of requiredFields) {
            if (!body.includes(field)) {
                fail('defineEnvSystem(' + flag + ') is missing required field ' + field.replace(':', ''));
            }
        }
        if (!body.includes('category:') || !body.includes('instances:')) {
            fail('defineEnvSystem(' + flag + ') budget must include category and instances');
        }
    }

    const loadOnlyFlags = new Set(['dreamPortals', 'aquaticLife']);
    const flagsNeedingPlugins = envTypeKeys.filter((f) => !loadOnlyFlags.has(f));
    const missingPlugins = flagsNeedingPlugins.filter((f) => !pluginOrder.includes(f));
    if (missingPlugins.length) {
        fail(`PLUGIN_ORDER missing flags: ${missingPlugins.join(', ')}`);
    }

    const enabledInLevels = parseEnabledDeferredFlagsInLevels(levelConfigSrc, deferredFlags);
    for (const flag of enabledInLevels) {
        if (!manifestFlags.includes(flag)) {
            fail(`Level config enables deferred flag "${flag}" with no manifest loader`);
        }
    }

    console.log(
        `level_env_registry check OK — ${deferredFlags.length} deferred, ${eagerFlags.length} eager, ${pluginOrder.length} plugins, ${enabledInLevels.size} deferred flags used in levels`
    );
}

main();
