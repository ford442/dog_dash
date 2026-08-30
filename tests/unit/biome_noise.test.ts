import test from 'node:test';
import assert from 'node:assert/strict';
import { BiomeNoiseSystem } from '../../src/biome_noise.ts';

test('BiomeNoiseSystem defaults to JS backend without WASM bind', () => {
    const noise = new BiomeNoiseSystem();
    assert.equal(noise.backend, 'js');
});

test('sample returns values in [0, 1]', () => {
    const noise = new BiomeNoiseSystem();
    for (const x of [0, 64, 128, 512, 1024]) {
        const value = noise.sample(x, 'foliage');
        assert.ok(value >= 0 && value <= 1, `sample(${x}) = ${value}`);
    }
});

test('sample is deterministic and chunk-cached for the same worldX', () => {
    const noise = new BiomeNoiseSystem();
    const a = noise.sample(200, 'foliage');
    const b = noise.sample(200.1, 'foliage');
    const c = noise.sample(200, 'foliage');
    assert.equal(a, b);
    assert.equal(a, c);
});

test('channels diverge at the same worldX', () => {
    const noise = new BiomeNoiseSystem();
    const foliage = noise.sample(300, 'foliage');
    const candy = noise.sample(300, 'candy');
    assert.notEqual(foliage, candy);
});

test('bindRunSeed changes samples at the same worldX', () => {
    const noise = new BiomeNoiseSystem();
    noise.bindRunSeed(100);
    const a = noise.sample(200, 'foliage');
    noise.bindRunSeed(200);
    const b = noise.sample(200, 'foliage');
    assert.notEqual(a, b);
});

test('densityMultiplier is centered on 1.0', () => {
    const noise = new BiomeNoiseSystem();
    const mult = noise.densityMultiplier(400, 'spore', 0.6);
    assert.ok(mult >= 0.4 && mult <= 1.6, `densityMultiplier = ${mult}`);
});
