import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('LevelManager orders disposeLevelStreamingResources before applyEnvironmentPlugins', () => {
    const managerSource = readFileSync(join(process.cwd(), 'src/level_manager/manager.ts'), 'utf-8');

    const applyIdx = managerSource.indexOf('applyEnvironmentPlugins(this, cfg, environments, levelLength);');
    const disposeIdx = managerSource.indexOf('this.disposeLevelStreamingResources();');

    assert.ok(applyIdx > -1, 'applyEnvironmentPlugins should be present');
    assert.ok(disposeIdx > -1, 'disposeLevelStreamingResources should be present');

    assert.ok(disposeIdx < applyIdx, 'disposeLevelStreamingResources must be called before applyEnvironmentPlugins to avoid cleaning up newly activated systems');
});

test('LevelManager clears streamed flora before the level-start populateZone', () => {
    const managerSource = readFileSync(join(process.cwd(), 'src/level_manager/manager.ts'), 'utf-8');

    const clearIdx = managerSource.indexOf('this.clearStreamedFlora();');
    const populateIdx = managerSource.indexOf('populateZone(this, playerX + STREAM_AHEAD_START, playerX + STREAM_AHEAD_END, cfg);');

    assert.ok(clearIdx > -1, 'clearStreamedFlora should be called at level start');
    assert.ok(populateIdx > -1, 'level-start populateZone should be present');
    assert.ok(
        clearIdx < populateIdx,
        'clearing after the first populate wipes the opening sails / pinwheels / chimes of every level'
    );
});
