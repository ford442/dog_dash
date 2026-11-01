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
