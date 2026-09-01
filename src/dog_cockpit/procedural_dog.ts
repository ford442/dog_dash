import * as THREE from 'three';
import type { DogBones } from './types';

export const EXPECTED_DOG_BONE_SLOTS: readonly (keyof DogBones)[] = [
    'root',
    'body',
    'head',
    'neck',
    'tail',
    'tailTip',
    'leftEar',
    'rightEar',
    'leftFrontPaw',
    'rightFrontPaw',
    'leftBackPaw',
    'rightBackPaw',
    'nose',
    'earLeft',
    'earRight',
    'pilotHead',
    'pilotGroup'
];

export type ProceduralDogResult = {
    group: THREE.Group;
    bones: DogBones;
};

const FUR = 0xf4d0a5;
const FUR_DARK = 0xc48a5a;
const PINK = 0xffb6c1;
const NOSE = 0x3a2a28;
const HELMET_RIM = 0xffc0cb;

/**
 * Tiny low-poly astronaut dog for rockets whose GLB has no armature.
 * Named nodes match DogBones so existing animation_states / dog_motion work.
 */
export function createProceduralDog(): ProceduralDogResult {
    const furMat = new THREE.MeshStandardMaterial({
        color: FUR,
        roughness: 0.85,
        metalness: 0.05
    });
    const darkFurMat = new THREE.MeshStandardMaterial({
        color: FUR_DARK,
        roughness: 0.85,
        metalness: 0.05
    });
    const pinkMat = new THREE.MeshStandardMaterial({
        color: PINK,
        roughness: 0.8
    });
    const noseMat = new THREE.MeshStandardMaterial({
        color: NOSE,
        roughness: 0.4
    });
    const helmetMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.22,
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.85,
        thickness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    const rimMat = new THREE.MeshStandardMaterial({
        color: HELMET_RIM,
        roughness: 0.3,
        metalness: 0.55
    });

    const group = new THREE.Group();
    group.name = 'pilotGroup';

    const body = new THREE.Group();
    body.name = 'body';
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), furMat);
    bodyMesh.scale.set(1, 0.9, 0.85);
    bodyMesh.castShadow = true;
    body.add(bodyMesh);

    const makePaw = (name: string, x: number, y: number, z: number): THREE.Mesh => {
        const paw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), darkFurMat);
        paw.name = name;
        paw.position.set(x, y, z);
        paw.castShadow = true;
        body.add(paw);
        return paw;
    };
    const leftFrontPaw = makePaw('leftFrontPaw', -0.16, -0.22, 0.16);
    const rightFrontPaw = makePaw('rightFrontPaw', 0.16, -0.22, 0.16);
    const leftBackPaw = makePaw('leftBackPaw', -0.16, -0.22, -0.14);
    const rightBackPaw = makePaw('rightBackPaw', 0.16, -0.22, -0.14);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), furMat);
    tail.name = 'tail';
    tail.position.set(0, 0.02, -0.32);
    tail.rotation.x = Math.PI / 2.4;
    tail.castShadow = true;
    body.add(tail);

    const head = new THREE.Group();
    head.name = 'head';
    head.position.set(0, 0.32, 0.08);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), furMat);
    headMesh.castShadow = true;
    head.add(headMesh);

    const makeEar = (name: string, x: number, flip: number): THREE.Mesh => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), pinkMat);
        ear.name = name;
        ear.position.set(x, 0.18, -0.02);
        ear.rotation.z = flip * 0.35;
        head.add(ear);
        return ear;
    };
    const leftEar = makeEar('leftEar', -0.12, 1);
    const rightEar = makeEar('rightEar', 0.12, -1);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), noseMat);
    nose.name = 'nose';
    nose.position.set(0, -0.02, 0.2);
    head.add(nose);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), helmetMat);
    helmet.name = 'helmet';
    helmet.position.set(0, 0.02, 0);
    head.add(helmet);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 6, 16), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, -0.04, 0.04);
    head.add(rim);

    body.add(head);
    group.add(body);

    const bones: DogBones = {
        root: group as unknown as THREE.Bone,
        body: body as unknown as THREE.Bone,
        head: head as unknown as THREE.Bone,
        tail: tail as unknown as THREE.Bone,
        leftEar: leftEar as unknown as THREE.Bone,
        rightEar: rightEar as unknown as THREE.Bone,
        earLeft: leftEar as unknown as THREE.Bone,
        earRight: rightEar as unknown as THREE.Bone,
        leftFrontPaw: leftFrontPaw as unknown as THREE.Bone,
        rightFrontPaw: rightFrontPaw as unknown as THREE.Bone,
        leftBackPaw: leftBackPaw as unknown as THREE.Bone,
        rightBackPaw: rightBackPaw as unknown as THREE.Bone,
        nose: nose as unknown as THREE.Bone,
        pilotGroup: group,
        pilotHead: head
    };

    return { group, bones };
}

/** Scale and sit the dog near the rocket nose (local +Y after player_loader centering). */
export function placeProceduralDogOnRocket(group: THREE.Group, rocketMesh: THREE.Object3D): void {
    rocketMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rocketMesh);
    const size = box.getSize(new THREE.Vector3());
    const shortest = Math.max(0.05, Math.min(size.x, size.y, size.z));
    const worldScale = shortest * 0.38;
    const parentScale = rocketMesh.getWorldScale(new THREE.Vector3());
    const avgParent = (Math.abs(parentScale.x) + Math.abs(parentScale.y) + Math.abs(parentScale.z)) / 3 || 1;
    group.scale.setScalar(worldScale / avgParent);

    const localMax = rocketMesh.worldToLocal(box.max.clone());
    const localMin = rocketMesh.worldToLocal(box.min.clone());
    const localY = (localMin.y + localMax.y) * 0.5 + (localMax.y - localMin.y) * 0.28;
    group.position.set(0, localY, 0);
}
