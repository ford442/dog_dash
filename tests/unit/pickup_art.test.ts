import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    PROJECTILE_KINDS,
    WEAPON_UPGRADE_IDS,
    getProjectileBoltGeometry,
    getUpgradeEmblemGeometry,
    projectileKindForUpgrade
} from '../../src/pickup_art/upgrade_art.ts';
import { PickupManager, UpgradePickup, UpgradeSystem, UPGRADE_CONFIGS } from '../../src/upgrade_system.ts';
import { WeaponSystem } from '../../src/weapons.ts';
import { buildPowerUpRig, BUTTERFLY_ESCORT_COUNT, POWERUP_EXPIRY_BLINK } from '../../src/pickup_art/powerup_rigs.ts';
import { PowerUpType, POWER_UP_CONFIGS } from '../../src/powerup_manager/types.ts';
import { PowerUpManager } from '../../src/powerup_manager/manager.ts';
import { SlingableObjectSystem } from '../../src/slingable_objects.ts';
import {
    SLINGABLE_ART_KINDS,
    getSlingableBodyGeometry,
    getSlingableDetailGeometry
} from '../../src/pickup_art/slingable_art.ts';
import { createPlaceholderRocketModel } from '../../src/pickup_art/placeholder_rocket.ts';
import { createPlaceholderPlayer } from '../../src/player_loader.ts';
import { isSharedResource } from '../../src/gpu_resources.ts';
import { disposeObject } from '../../src/utils.ts';
import type { DebrisSystem, ParticleSystem } from '../../src/particles.ts';

const noopParticles = { emit: () => {} } as unknown as ParticleSystem;
const noopDebris = { emit: () => {} } as unknown as DebrisSystem;

function aspect(geo: THREE.BufferGeometry): string {
    geo.computeBoundingBox();
    const s = geo.boundingBox!.getSize(new THREE.Vector3());
    return [s.x, s.y].map((n) => n.toFixed(2)).join('x');
}

function meshCount(obj: THREE.Object3D): number {
    let n = 0;
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; });
    return n;
}

test('upgrade emblems: four shared shapes that differ in silhouette and fit the old footprint', () => {
    const aspects = new Set<string>();
    for (const id of WEAPON_UPGRADE_IDS) {
        const geo = getUpgradeEmblemGeometry(id);
        assert.equal(getUpgradeEmblemGeometry(id), geo, `${id} built once`);
        assert.ok(isSharedResource(geo), `${id} markShared`);
        assert.ok(geo.attributes.color, `${id} has vertex colour`);
        assert.ok(geo.boundingSphere!.radius < 0.8, `${id} stays inside the 1.5u collection radius with room to spare`);
        aspects.add(aspect(geo));
    }
    assert.equal(aspects.size, 4, 'each upgrade has its own proportions (shape, not just colour)');
});

test('upgrade pickup: emblem + ring, sim-driven collect (no requestAnimationFrame), shared geometry survives', () => {
    const scene = new THREE.Scene();
    const pickup = new UpgradePickup(scene, new THREE.Vector3(3, 1, 0), 'pyro');
    assert.equal(pickup.emblem.geometry, getUpgradeEmblemGeometry('pyro'));
    assert.equal(pickup.mesh.parent, scene);
    pickup.collect();
    let done = false;
    for (let i = 0; i < 60 && !done; i++) done = pickup.updateCollect(1 / 60);
    assert.ok(done, 'collect animation finishes within a second of sim time');
    assert.equal(pickup.mesh.parent, null);
    assert.ok(getUpgradeEmblemGeometry('pyro').attributes.position.count > 0, 'shared emblem not disposed');
});

test('pickup manager: collecting one token no longer drops its neighbour', () => {
    const scene = new THREE.Scene();
    const mgr = new PickupManager(scene);
    mgr.pickups.push(new UpgradePickup(scene, new THREE.Vector3(0, 0, 0), 'cryo'));
    mgr.pickups.push(new UpgradePickup(scene, new THREE.Vector3(10, 0, 0), 'rapid'));
    const got = mgr.update(1 / 60, 0, new THREE.Vector3(10, 0, 0));
    assert.equal(got, 'rapid');
    assert.equal(mgr.pickups.length, 1, 'the cryo token is still in play');
    assert.equal(mgr.pickups[0].upgradeType, 'cryo');
    for (let i = 0; i < 30; i++) mgr.update(1 / 60, i / 60, new THREE.Vector3(10, 0, 0));
    assert.equal(mgr.collecting.length, 0, 'collected token finished its pop and was freed');
});

test('orbit icons: share the pickup emblem and drain as a timer gauge', () => {
    const scene = new THREE.Scene();
    const player = new THREE.Group();
    const sys = new UpgradeSystem(scene, { onUpgradeStart: () => {}, onUpgradeEnd: () => {} });
    sys.setPlayerGroup(player);
    sys.activateUpgrade('pierce');
    assert.equal(sys.orbitingIcons.length, 3);
    for (const icon of sys.orbitingIcons) assert.equal(icon.geometry, getUpgradeEmblemGeometry('pierce'));
    const visible = () => sys.orbitingIcons.filter((i) => i.visible).length;
    sys.update(0, 0);
    assert.equal(visible(), 3);
    sys.upgradeTimer = UPGRADE_CONFIGS.pierce.duration * 0.5;
    sys.update(0, 0);
    assert.equal(visible(), 2, 'one icon per remaining third');
    sys.destroy();
    assert.equal(player.children.length, 0);
});

test('projectiles: one bolt shape per loadout, same hitbox, in-flight shots keep their loadout', () => {
    const geos = new Set(PROJECTILE_KINDS.map((k) => getProjectileBoltGeometry(k)));
    assert.equal(geos.size, PROJECTILE_KINDS.length);
    const aspects = new Set(PROJECTILE_KINDS.map((k) => aspect(getProjectileBoltGeometry(k))));
    assert.equal(aspects.size, PROJECTILE_KINDS.length, 'bolts differ in shape');

    assert.equal(projectileKindForUpgrade('none'), 'plasma');
    assert.equal(projectileKindForUpgrade('cryo'), 'cryo');

    const ws = new WeaponSystem(new THREE.Scene());
    ws.setKind('cryo');
    ws.fire(new THREE.Vector3(), new THREE.Vector3(1, 0, 0));
    const [shot] = ws.getActiveProjectiles();
    assert.equal(shot.kind, 'cryo');
    assert.equal(shot.mesh.geometry, getProjectileBoltGeometry('cryo'));
    ws.setKind('plasma');
    assert.equal(shot.kind, 'cryo', 'changing loadout does not repaint shots already flying');
    for (const p of ws.projectiles) assert.equal(p.radius, 0.5);
});

test('power-up rigs: all 16 types build an object, pose, blink at expiry and free their materials', () => {
    const types = Object.values(PowerUpType) as PowerUpType[];
    assert.equal(types.length, 16);
    for (const type of types) {
        const rig = buildPowerUpRig(type);
        assert.ok(meshCount(rig.root) >= 1, `${type} has a visible object`);
        const duration = POWER_UP_CONFIGS[type].duration;
        rig.update({ dt: 1 / 60, t: 1, timeLeft: duration, duration, bounce: 0 });
        assert.equal(rig.root.visible, true, `${type} visible mid-timer`);
        let blinkedOff = false;
        for (let i = 0; i < 120; i++) {
            const t = i / 60;
            rig.update({ dt: 1 / 60, t, timeLeft: POWERUP_EXPIRY_BLINK * (1 - i / 120), duration, bounce: 0 });
            if (!rig.root.visible) blinkedOff = true;
        }
        assert.ok(blinkedOff, `${type} blinks in its last ${POWERUP_EXPIRY_BLINK}s`);
        disposeObject(rig.root);
    }
});

test('power-up rigs: comet tail is a timer gauge; escort has one butterfly per charge', () => {
    const comet = buildPowerUpRig(PowerUpType.RAINBOW_COMET_TAIL);
    const tail = comet.root.children[0];
    comet.update({ dt: 0, t: 0, timeLeft: 12, duration: 12, bounce: 0 });
    const full = tail.scale.x;
    comet.update({ dt: 0, t: 0, timeLeft: 3, duration: 12, bounce: 0 });
    assert.ok(tail.scale.x < full * 0.6, 'tail shortens as the timer drains');

    const escort = buildPowerUpRig(PowerUpType.BUTTERFLY_ESCORT);
    assert.equal(escort.butterflies?.length, BUTTERFLY_ESCORT_COUNT);
    assert.equal(BUTTERFLY_ESCORT_COUNT, 3, 'matches butterflyCharges in powerup_effect.ts');
});

test('power-up manager: attachments ride on the rocket and a blocked hit removes one butterfly', () => {
    const scene = new THREE.Scene();
    const rocket = new THREE.Group();
    const mgr = new PowerUpManager({ scene, particleSystem: noopParticles, audioSystem: undefined as never, rocket: undefined });
    mgr.setRocket(rocket);
    mgr.activatePowerUp(PowerUpType.BUBBLEGUM_SHIELD);
    assert.ok(rocket.getObjectByName(`powerup_${PowerUpType.BUBBLEGUM_SHIELD}`), 'shield rig attached to the rocket');
    mgr.triggerShieldBounce();
    mgr.update(1 / 60, new THREE.Vector3());

    mgr.activatePowerUp(PowerUpType.BUTTERFLY_ESCORT);
    const escort = rocket.getObjectByName(`powerup_${PowerUpType.BUTTERFLY_ESCORT}`)!;
    const visibleButterflies = () => escort.children.filter((c) => c.visible).length;
    assert.equal(visibleButterflies(), 3);
    assert.equal(mgr.consumeButterflyCharge(), true);
    assert.equal(visibleButterflies(), 2);

    mgr.clearAll();
    assert.equal(rocket.getObjectByName(`powerup_${PowerUpType.BUBBLEGUM_SHIELD}`), undefined, 'removed on end');
});

test('slingables: shared unit bodies, kind-specific parts, collision radius unchanged', () => {
    const scene = new THREE.Scene();
    const sys = new SlingableObjectSystem(scene, noopParticles, noopDebris);
    const aspects = new Set<string>();
    for (const kind of SLINGABLE_ART_KINDS) {
        const body = getSlingableBodyGeometry(kind);
        const detail = getSlingableDetailGeometry(kind);
        assert.ok(isSharedResource(body) && isSharedResource(detail), `${kind} geometry is shared`);
        // Art may poke out a little (hooks, chain), but the mass stays near the collision sphere.
        assert.ok(body.boundingSphere!.radius <= 1.3, `${kind} body within 1.3 × radius`);
        const all = new THREE.Box3().union(body.boundingBox!).union(detail.boundingBox!);
        const s = all.getSize(new THREE.Vector3());
        aspects.add([s.x, s.y, s.z].map((n) => n.toFixed(1)).join('x'));

        const obj = sys.createObject(new THREE.Vector3(), { kind, radius: 1.4, velocity: new THREE.Vector3() });
        assert.equal(obj.radius, 1.4);
        assert.equal(obj.rig?.root.scale.x, 1.4);
        sys.update(1 / 60, 0, new THREE.Vector3(3, 0, 0));
    }
    assert.ok(aspects.size >= 4, 'kinds differ in shape');
    const sprite = sys.objects.find((o) => o.kind === 'tetherSprite')!;
    assert.equal(sprite.rig?.wings?.length, 2);
    assert.equal(Math.abs(sprite.spin.x) + Math.abs(sprite.spin.y), 0, 'creatures do not tumble their faces away');
    sys.dispose();
    assert.ok(getSlingableBodyGeometry('rock').attributes.position.count > 0, 'shared body survives disposeObject');
});

test('placeholder rocket: nose up, ~2 units tall, flame at the nozzle, nose +X once laid down', () => {
    const model = createPlaceholderRocketModel();
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.y - 2) < 0.1, `height ${size.y.toFixed(2)}`);
    assert.ok(size.y > size.x && size.y > size.z, 'long axis is +Y like the normalised GLB');

    const scene = new THREE.Scene();
    const player = createPlaceholderPlayer(scene);
    const rocket = player.children[0];
    rocket.updateWorldMatrix(true, true);
    const flame = rocket.userData.flame as THREE.Mesh;
    const flameWorld = flame.getWorldPosition(new THREE.Vector3());
    const noseWorld = new THREE.Vector3(0, 1, 0).applyMatrix4(rocket.matrixWorld);
    assert.ok(noseWorld.x > flameWorld.x + 1.5, 'nose ahead of the flame along +X');
});
