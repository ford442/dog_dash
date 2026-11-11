import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const gate = require('../../tools/check_math_random.cjs') as {
    check(): { violations: string[]; shrunk: string[] };
    isGameplayPath(rel: string): boolean;
};

test('no unseeded Math.random() on gameplay paths, and no new legacy ones', () => {
    const { violations } = gate.check();
    assert.deepEqual(violations, [], violations.join('\n'));
});

test('spawn / combat / harvest paths are gate-listed', () => {
    for (const rel of ['src/obstacle_system/manager.ts', 'src/weapons.ts', 'src/boss_system/zephyr_boss.ts', 'src/collectibles/manager.ts', 'src/main/loop_combat/pickups.ts']) {
        assert.ok(gate.isGameplayPath(rel), rel);
    }
});
