import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HolographicDataStreamsSystem } from '../../src/holographic_data_streams.ts';

test('HolographicDataStreamsSystem: re-adds mesh to scene upon activation after cleanup', () => {
    const scene = new THREE.Scene();
    const system = new HolographicDataStreamsSystem(scene);

    // Initial state after construction: mesh should be added but system inactive
    assert.equal(system.mesh.parent, scene);
    assert.equal(system.active, false);

    // Activate the system
    system.activate();
    assert.equal(system.active, true);
    assert.equal(system.mesh.parent, scene);

    // Cleanup should remove the mesh from the scene
    system.cleanup();
    assert.notEqual(system.mesh.parent, scene);

    // Reactivate the system and ensure the mesh is re-added
    system.activate();
    assert.equal(system.active, true);
    assert.equal(system.mesh.parent, scene);
});
