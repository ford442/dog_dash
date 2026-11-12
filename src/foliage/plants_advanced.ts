import * as THREE from 'three';
import { createClayMaterial, foliageMaterials, reactiveMaterials, registerReactiveMaterial } from '../foliage_shared';

export function createSubwooferLotus(options: any = {}) {
    const { color = 0x2E8B57 } = options;
    const group = new THREE.Group();

    // The Pad (Speaker Cone)
    const padGeo = new THREE.CylinderGeometry(1.5, 0.2, 0.5, 16);
    padGeo.translate(0, 0.25, 0); // Pivot at bottom
    const padMat = createClayMaterial(color);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.castShadow = true;
    pad.receiveShadow = true;

    // Add "Equalizer" Rings on top
    const ringMat = foliageMaterials.lotusRing.clone(); // Clone to animate independently
    ringMat.emissive.setHex(0x000000);
    pad.userData.ringMaterial = ringMat;

    for (let i = 1; i <= 3; i++) {
        const ringGeo = new THREE.TorusGeometry(i * 0.3, 0.05, 8, 24);
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.51; // Sit just on top
        pad.add(ring);
    }

    group.add(pad);

    group.userData.animationType = 'speakerPulse';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'lotus';

    return group;
}

/**
 * 2. The Accordion Palm
 * Pleated trunk that stretches.
 */
export function createAccordionPalm(options: any = {}) {
    const { color = 0xFFD700 } = options;
    const group = new THREE.Group();

    const trunkHeight = 3.0;
    const segments = 10;
    const trunkGroup = new THREE.Group();

    const pleatGeo = new THREE.TorusGeometry(0.3, 0.15, 8, 16);
    const pleatMat = createClayMaterial(0x8B4513); // Brown wood

    for (let i = 0; i < segments; i++) {
        const pleat = new THREE.Mesh(pleatGeo, pleatMat);
        pleat.rotation.x = Math.PI / 2;
        pleat.position.y = i * (trunkHeight / segments);
        if (i % 2 === 0) {
            pleat.material = createClayMaterial(0xA0522D);
        }
        trunkGroup.add(pleat);
    }
    group.add(trunkGroup);

    // Leaves on top
    const leafCount = 6;
    const leafGeo = new THREE.CylinderGeometry(0.05, 0.1, 1.5, 8);
    leafGeo.translate(0, 0.75, 0); // Pivot at base
    const leafMat = createClayMaterial(color);
    registerReactiveMaterial(leafMat);

    const headGroup = new THREE.Group();
    headGroup.position.y = trunkHeight;
    trunkGroup.add(headGroup);

    for (let i = 0; i < leafCount; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.rotation.z = Math.PI / 3;
        leaf.rotation.y = (i / leafCount) * Math.PI * 2;
        headGroup.add(leaf);
    }

    group.userData.animationType = 'accordionStretch';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'tree';
    group.userData.trunk = trunkGroup;

    return group;
}

/**
 * 3. The Fiber-Optic Weeping Willow
 * Glowing cables that whip around.
 */
export function createFiberOpticWillow(options: any = {}) {
    const { color = 0xFFFFFF } = options;
    const group = new THREE.Group();

    // Trunk
    const trunkH = 2.5 + Math.random();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.4, trunkH, 12),
        createClayMaterial(0x222222) // Dark trunk
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Cable Branches
    const branchCount = 12;
    const cableMat = foliageMaterials.opticCable;
    const tipMat = foliageMaterials.opticTip.clone();
    registerReactiveMaterial(tipMat);

    for (let i = 0; i < branchCount; i++) {
        const branchGroup = new THREE.Group();
        branchGroup.position.y = trunkH * 0.9;
        branchGroup.rotation.y = (i / branchCount) * Math.PI * 2;

        const len = 1.5 + Math.random();
        const cableGeo = new THREE.CylinderGeometry(0.02, 0.02, len, 4);
        cableGeo.translate(0, -len / 2, 0); // Hang down
        const cable = new THREE.Mesh(cableGeo, cableMat);

        cable.rotation.z = Math.PI / 4;

        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), tipMat);
        tip.position.y = -len;
        cable.add(tip);

        branchGroup.add(cable);
        group.add(branchGroup);
    }

    group.userData.animationType = 'fiberWhip';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'willow';

    return group;
}

// --- Instancing System (Grass) ---
let grassMeshes: THREE.InstancedMesh[] = [];
