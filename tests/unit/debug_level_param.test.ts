import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDebugLevel, DEBUG_LEVEL_MIN, DEBUG_LEVEL_MAX } from '../../src/debug_system.ts';
import { LEVEL_CONFIG } from '../../src/level_config.ts';

test('?level=N accepts every campaign chapter, with or without the leading ?', () => {
    for (let n = DEBUG_LEVEL_MIN; n <= DEBUG_LEVEL_MAX; n++) {
        assert.equal(parseDebugLevel(`?level=${n}`), n);
        assert.equal(parseDebugLevel(`level=${n}`), n);
    }
});

test('?level=N coexists with other flags', () => {
    assert.equal(parseDebugLevel('?debug&level=3&wireframe'), 3);
    assert.equal(parseDebugLevel('?seed=abc&level=6'), 6);
});

test('?level=N rejects anything that is not a whole chapter number', () => {
    for (const bad of ['', '?', '?debug', '?level', '?level=', '?level=0', '?level=7', '?level=-1',
        '?level=2.5', '?level=abc', '?level=3x', '?level=1e1', '?level=99']) {
        assert.equal(parseDebugLevel(bad), null, `expected null for "${bad}"`);
    }
});

test('debug level range matches LEVEL_CONFIG', () => {
    const chapters = Object.keys(LEVEL_CONFIG).map(Number);
    assert.equal(DEBUG_LEVEL_MIN, Math.min(...chapters));
    assert.equal(DEBUG_LEVEL_MAX, Math.max(...chapters));
});
