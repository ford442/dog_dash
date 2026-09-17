import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PIXEL_RATIO_PRESETS,
    parsePixelRatioPreset,
    indexForPixelRatio,
    defaultPixelRatioIndex,
    RESOLUTION_RATIOS
} from '../../src/pixel_ratio.ts';
import { wantsOptionalPostFx } from '../../src/pixel_ratio.ts';
import {
    collectOptionalDeviceFeatures,
    buildDeviceDescriptor,
    shouldRequestDebugGpuFeatures
} from '../../src/webgpu_probe.ts';

test('pixel-ratio presets are named and default is 0.75 not 0.60', () => {
    assert.equal(PIXEL_RATIO_PRESETS.quality, 1);
    assert.equal(PIXEL_RATIO_PRESETS.default, 0.75);
    assert.equal(PIXEL_RATIO_PRESETS.battery, 0.5);
    assert.equal(parsePixelRatioPreset(''), 'default');
    assert.equal(parsePixelRatioPreset('?quality=battery'), 'battery');
    assert.equal(parsePixelRatioPreset('?quality=quality'), 'quality');
    assert.ok(!RESOLUTION_RATIOS.includes(0.6 as never));
    assert.equal(RESOLUTION_RATIOS[defaultPixelRatioIndex()], 0.75);
    assert.equal(indexForPixelRatio(0.75), defaultPixelRatioIndex());
});

test('optional post FX is off by default and respects fx=0', () => {
    assert.equal(wantsOptionalPostFx(''), false);
    assert.equal(wantsOptionalPostFx('?fx=1'), true);
    assert.equal(wantsOptionalPostFx('?fx=0'), false);
});

test('device descriptor never requires features the adapter lacks', () => {
    const adapter = { features: new Set<string>(['depth-clip-control']) };
    assert.deepEqual(collectOptionalDeviceFeatures(adapter, true), []);
    const withTs = { features: new Set(['timestamp-query']) };
    assert.deepEqual(collectOptionalDeviceFeatures(withTs, true), ['timestamp-query']);
    assert.deepEqual(collectOptionalDeviceFeatures(withTs, false), []);
    const desc = buildDeviceDescriptor(['timestamp-query']);
    assert.equal(desc.label, 'dog-dash');
    assert.deepEqual(desc.requiredFeatures, ['timestamp-query']);
    assert.equal(desc.defaultQueue?.label, 'dog-dash-queue');
    assert.equal(desc.requiredLimits, undefined);
});

test('?debug is what opts into timestamp-query collection', () => {
    assert.equal(shouldRequestDebugGpuFeatures(''), false);
    assert.equal(shouldRequestDebugGpuFeatures('?debug'), true);
});
