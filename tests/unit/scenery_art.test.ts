import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { triangleCount } from '../../src/scenery_art/kit.ts';
import { getIsleGeometry, ISLE_MASK_LANTERN, ISLE_MASK_RING } from '../../src/scenery_art/isles.ts';
import { getPeekingStarGeometry, getStarBodyGeometry } from '../../src/scenery_art/star.ts';
import { getSpacePetGeometry } from '../../src/scenery_art/space_pet.ts';
import { getGeodeGeometry } from '../../src/scenery_art/geodes.ts';
import { getMirrorShardGeometry } from '../../src/scenery_art/mirror.ts';
import { getMoonGeometry, MOON_RADIUS } from '../../src/scenery_art/moon.ts';
import { getGalaxyGeometry } from '../../src/scenery_art/galaxy.ts';
import * as F from '../../src/scenery_art/foliage_shapes.ts';
import { GrappleIslesSystem } from '../../src/grapple_isles.ts';
import { HideAndSeekStarsSystem } from '../../src/hide_and_seek_stars.ts';
import { SpacePetsSwarmSystem } from '../../src/space_pets_swarm.ts';
import { SingingGeodeSystem } from '../../src/singing_geodes.ts';
import { StormGeodeSystem } from '../../src/storm_geodes.ts';
import { QuantumMirrorsSystem } from '../../src/quantum_mirrors.ts';
import { CollectibleOrb } from '../../src/collectibles/orb.ts';
import { OrbType } from '../../src/collectibles/types.ts';
import { createGalaxy, createMoon, moonPlants } from '../../src/visuals.ts';
import {
    createBalloonBush,
    createFloatingOrb,
    createFloweringTree,
    createRainingCloud,
    createShrub
} from '../../src/foliage/plants_basic.ts';
import { isSharedResource } from '../../src/gpu_resources.ts';
import { disposeObject } from '../../src/utils.ts';

function size(geo: THREE.BufferGeometry): THREE.Vector3 {
    geo.computeBoundingBox();
    return geo.boundingBox!.getSize(new THREE.Vector3());
}

function meshes(obj: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); });
    return out;
}

function maskValues(geo: THREE.BufferGeometry): Set<number> {
    const a = geo.attributes.aMask;
    const set = new Set<number>();
    for (let i = 0; i < a.count; i++) set.add(a.getX(i));
    return set;
}

/**
 * Triangle ceilings per shared scenery geometry. Scenery must not grow for
 * the sake of detail (#418): these pin the current cost so a later change
 * that adds triangles has to update the number (and docs/ENV_ASSET_AUDIT.md).
 */
const TRIANGLE_CEILINGS: Array<[string, () => THREE.BufferGeometry, number]> = [
    ['isle', getIsleGeometry, 160],
    ['star body', getStarBodyGeometry, 80],
    ['peeking star', getPeekingStarGeometry, 90],
    ['space pet', getSpacePetGeometry, 264], // the 12×12 sphere it replaced
    ['singing geode', () => getGeodeGeometry('singing'), 240],
    ['storm geode', () => getGeodeGeometry('storm'), 130],
    ['mirror shard', getMirrorShardGeometry, 20], // same as Icosahedron(2, 0)
    ['galaxy disc', getGalaxyGeometry, 2],
    ['moon', getMoonGeometry, 5200]
];

test('scenery geometry: built once, shared, vertex-coloured and inside its triangle ceiling', () => {
    for (const [name, get, ceiling] of TRIANGLE_CEILINGS) {
        const geo = get();
        assert.equal(get(), geo, `${name} built once`);
        assert.ok(isSharedResource(geo), `${name} markShared`);
        if (name !== 'galaxy disc') assert.ok(geo.attributes.color, `${name} has vertex colour`);
        const tris = triangleCount(geo);
        assert.ok(tris <= ceiling, `${name}: ${tris} triangles > ceiling ${ceiling}`);
    }
});

test('grapple isle: upright island taller below than above, with lantern and hook ring regions', () => {
    const geo = getIsleGeometry();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    assert.ok(-box.min.y > box.max.y, 'rocky underside hangs deeper than the props stand');
    assert.ok(box.max.y > 0.8, 'tree stands above the grass');
    assert.deepEqual([...maskValues(geo)].sort(), [0, ISLE_MASK_LANTERN, ISLE_MASK_RING]);
});

test('stars: the backdrop star is the pickup star (same outline), facing the camera', () => {
    const body = size(getStarBodyGeometry());
    const peek = size(getPeekingStarGeometry());
    assert.ok(body.z < body.x * 0.5, 'star is flat, not a ball');
    assert.ok(Math.abs(peek.x / body.x - peek.y / body.y) < 0.02, 'same aspect: same outline, scaled');

    const scene = new THREE.Scene();
    const orb = new CollectibleOrb(scene, 0, 0, 0, OrbType.STAR);
    const core = meshes(orb.mesh).find((m) => m.geometry === getStarBodyGeometry());
    assert.ok(core, 'collectible star uses the shared star body');
    orb.destroy(scene);
    assert.ok(getStarBodyGeometry().attributes.position.count > 0, 'destroy leaves the shared star alone');
});

test('geodes: singing and storm differ in shape, both open with a crystal region', () => {
    const sing = size(getGeodeGeometry('singing'));
    const storm = size(getGeodeGeometry('storm'));
    assert.ok(storm.x / storm.y > 1.4, 'storm geode is a flat, wide burst');
    assert.ok(sing.x / sing.y < 1.15, 'singing geode is round');
    for (const kind of ['singing', 'storm'] as const) {
        assert.deepEqual([...maskValues(getGeodeGeometry(kind))].sort(), [0, 1], `${kind}: shell + crystals`);
    }
});

test('scenery systems build on the shared geometry and their cleanup never frees it', () => {
    const scene = new THREE.Scene();
    const isles = new GrappleIslesSystem(scene);
    const stars = new HideAndSeekStarsSystem(scene);
    const pets = new SpacePetsSwarmSystem(scene);
    const singing = new SingingGeodeSystem(scene);
    const storm = new StormGeodeSystem(scene);
    const mirrors = new QuantumMirrorsSystem(scene);

    assert.equal(stars.mesh.geometry, getPeekingStarGeometry());
    assert.equal(pets.mesh.geometry, getSpacePetGeometry());
    assert.equal(singing.mesh.geometry, getGeodeGeometry('singing'));
    assert.equal(storm.mesh.geometry, getGeodeGeometry('storm'));
    assert.equal(mirrors.mesh.geometry, getMirrorShardGeometry());

    // Exercise activate/update/deactivate once so the per-instance flare buffers are wired.
    singing.activate(5);
    singing.update(1 / 60, 0, new THREE.Vector3(0, 0, 0));
    storm.activate(5);
    storm.update(1 / 60, 0, new THREE.Vector3(0, 0, 0));
    isles.activate();
    isles.update(1 / 60, 0, new THREE.Vector3());
    stars.activate();
    stars.update(1 / 60, new THREE.Vector3());

    const disposed: string[] = [];
    for (const [name, geo] of [
        ['isle', getIsleGeometry()], ['star', getPeekingStarGeometry()], ['pet', getSpacePetGeometry()],
        ['singing', getGeodeGeometry('singing')], ['storm', getGeodeGeometry('storm')], ['mirror', getMirrorShardGeometry()]
    ] as Array<[string, THREE.BufferGeometry]>) {
        geo.addEventListener('dispose', () => disposed.push(name));
    }
    for (const sys of [isles, stars, pets, singing, storm, mirrors]) sys.cleanup();
    assert.deepEqual(disposed, [], 'shared scenery geometry survives cleanup');
});

test('backdrops: galaxy is one disc, moon is one merged mesh with carved craters', () => {
    const galaxy = createGalaxy(0, 0, 0, 0x8844ff);
    assert.equal(meshes(galaxy).length, 1, 'galaxy: one draw call (was 3 spheres)');

    const before = moonPlants.length;
    const moon = createMoon();
    moonPlants.splice(before);
    const surface = moon.children[0] as THREE.Mesh;
    assert.equal(surface.geometry, getMoonGeometry());
    // Only surface + atmosphere + plants: no stuck-on crater spheres.
    const sphereChildren = moon.children.filter((c) => (c as THREE.Mesh).geometry?.type === 'SphereGeometry');
    assert.equal(sphereChildren.length, 1, 'atmosphere is the only sphere left');

    const pos = getMoonGeometry().attributes.position;
    let carved = 0;
    for (let i = 0; i < pos.count; i++) {
        const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (r < MOON_RADIUS - 0.3) carved++;
    }
    assert.ok(carved > 100, 'crater floors sit below the surface');
});

test('foliage: sphere plants are now 1–2 merged shared meshes and keep their animation contract', () => {
    for (const [name, make, maxMeshes] of [
        ['shrub', () => createShrub(), 2],
        ['balloon bush', () => createBalloonBush(), 2],
        ['raining cloud', () => createRainingCloud(), 1],
        ['floating orb', () => createFloatingOrb(), 1],
        ['flowering tree', () => createFloweringTree(), 2]
    ] as Array<[string, () => THREE.Object3D, number]>) {
        const plant = make();
        const ms = meshes(plant);
        assert.ok(ms.length >= 1 && ms.length <= maxMeshes, `${name}: ${ms.length} meshes`);
        for (const m of ms) assert.ok(isSharedResource(m.geometry), `${name}: shared geometry`);
        assert.ok(plant.userData.animationType, `${name}: animationType kept`);
        disposeObject(plant);
        for (const m of ms) assert.ok(m.geometry.attributes.position.count > 0, `${name}: shared geometry survives dispose`);
    }
    const cloud = createRainingCloud();
    assert.ok((cloud.children[1] as THREE.Points).isPoints, "rain stays at children[1] for the 'rain' animation");
    for (let v = 0; v < F.FOLIAGE_VARIANTS; v++) {
        assert.ok(triangleCount(F.getShrubLeafGeometry(v)) + triangleCount(F.getShrubFlowerGeometry(v)) < 480,
            'shrub cheaper than the old 16×16 sphere alone');
    }
});
