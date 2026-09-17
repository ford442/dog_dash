/**
 * Ice Needle clusters — hexagonal crystal matrices with boost-melt and cryo stacks.
 */

import * as THREE from 'three';
import {
    hexNeedleOffsets,
    pickIceNeedleCount,
    ICE_BOOST_MELT_RADIUS,
    ICE_CONTACT_RADIUS,
    ICE_HEX_SPACING,
    ICE_MAGMA_SUBLIMATE_RADIUS,
    meltProgress,
    applyCryoHit,
    CRYO_MAX_STACKS
} from './flora_gameplay';

export type IceNeedleState = {
    melt: number;
    alive: boolean;
    x: number;
    y: number;
    z: number;
};

const _dummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

export function createIceNeedleCluster(config: { count: number; random?: () => number }): THREE.Group {
    const group = new THREE.Group();
    const count = Math.max(1, config.count);
    const offsets = hexNeedleOffsets(count, ICE_HEX_SPACING);
    const geo = new THREE.ConeGeometry(0.22, 3.6, 6);
    const material = new THREE.MeshPhysicalMaterial({
        color: 0xaaddff,
        transmission: 0.75,
        opacity: 0.92,
        transparent: true,
        metalness: 0.08,
        roughness: 0.05,
        ior: 1.31
    });
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const needles: IceNeedleState[] = [];
    for (let i = 0; i < count; i++) {
        const o = offsets[i]!;
        needles.push({ melt: 0, alive: true, x: o.x, y: o.y, z: o.z });
        writeNeedleMatrix(mesh, i, needles[i]!, 1);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);

    group.userData = {
        type: 'iceNeedleCluster',
        speciesId: 'iceNeedleCluster',
        needleMesh: mesh,
        needles,
        count
    };
    return group;
}

function writeNeedleMatrix(mesh: THREE.InstancedMesh, index: number, needle: IceNeedleState, scale: number): void {
    _dir.set(needle.x, needle.y + 0.8, needle.z);
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 1, 0);
    _dir.normalize();
    _dummy.position.set(needle.x, needle.y, needle.z);
    _dummy.quaternion.setFromUnitVectors(_up, _dir);
    _dummy.scale.setScalar(needle.alive ? scale : 0);
    _dummy.updateMatrix();
    mesh.setMatrixAt(index, _dummy.matrix);
}

export function updateIceNeedleCluster(group: THREE.Group, delta: number, _timeVal: number): void {
    group.rotation.y += delta * 0.05;
}

export type IceNeedleTickContext = {
    playerPosition: THREE.Vector3;
    boosting: boolean;
    magmaPositions: THREE.Vector3[];
    delta: number;
};

export type IceNeedleTickResult = {
    cryoHit: boolean;
    melted: number;
    sublimated: number;
};

export function tickIceNeedleCluster(group: THREE.Group, ctx: IceNeedleTickContext): IceNeedleTickResult {
    const mesh = group.userData.needleMesh as THREE.InstancedMesh | undefined;
    const needles = group.userData.needles as IceNeedleState[] | undefined;
    const result: IceNeedleTickResult = { cryoHit: false, melted: 0, sublimated: 0 };
    if (!mesh || !needles) return result;

    const origin = group.position;
    let dirty = false;

    for (let i = 0; i < needles.length; i++) {
        const needle = needles[i]!;
        if (!needle.alive) continue;
        const wx = origin.x + needle.x;
        const wy = origin.y + needle.y;
        const wz = origin.z + needle.z;
        const distPlayer = Math.hypot(
            ctx.playerPosition.x - wx,
            ctx.playerPosition.y - wy,
            ctx.playerPosition.z - wz
        );

        let melting = ctx.boosting && distPlayer <= ICE_BOOST_MELT_RADIUS;
        for (const magma of ctx.magmaPositions) {
            const md = Math.hypot(magma.x - wx, magma.y - wy, magma.z - wz);
            if (md <= ICE_MAGMA_SUBLIMATE_RADIUS) {
                melting = true;
                result.sublimated++;
                break;
            }
        }

        const prev = needle.melt;
        needle.melt = meltProgress(needle.melt, ctx.delta, melting);
        if (needle.melt >= 1) {
            needle.alive = false;
            result.melted++;
            writeNeedleMatrix(mesh, i, needle, 0);
            dirty = true;
            continue;
        }

        if (needle.melt !== prev) {
            writeNeedleMatrix(mesh, i, needle, 1 - needle.melt * 0.85);
            dirty = true;
        }

        if (distPlayer < ICE_CONTACT_RADIUS) {
            result.cryoHit = true;
        }
    }

    if (dirty) mesh.instanceMatrix.needsUpdate = true;
    return result;
}

export function iceNeedleCountFromRng(random: () => number): number {
    return pickIceNeedleCount(random);
}
