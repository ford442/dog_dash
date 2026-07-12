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

/**
 * 4. Solar Sails / Light Leaves
 * From plan.md: Thin-film catching solar wind with iridescence.
 * - 5-12 leaves, 10-20m long, attached to a crystalline pod.
 * - Thin-film interference shader for iridescence, rippling leaves.
 * - Unfold when near star/light source.
 */
export function createSolarSail(options: any = {}) {
    const { 
        color = 0x88aaff, 
        leafCount = 5 + Math.floor(Math.random() * 8),
        leafLength = 10 + Math.random() * 10
    } = options;
    const group = new THREE.Group();

    // Crystalline pod (center attachment point)
    const podGeo = new THREE.OctahedronGeometry(0.8, 1);
    const podMat = new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        roughness: 0.1,
        metalness: 0.8,
        emissive: 0x446688,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9
    });
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.castShadow = true;
    group.add(pod);

    // Inner glow for pod
    const podGlowGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const podGlowMat = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const podGlow = new THREE.Mesh(podGlowGeo, podGlowMat);
    group.add(podGlow);

    // Solar sail leaves (thin film with iridescence simulation)
    const leaves: THREE.Group[] = [];
    for (let i = 0; i < leafCount; i++) {
        const leafGroup = new THREE.Group();
        
        // Create a thin, elongated leaf shape
        const leafWidth = 0.5 + Math.random() * 0.5;
        const leafLen = leafLength * (0.7 + Math.random() * 0.3);
        
        // Use a plane geometry for the thin film
        const leafGeo = new THREE.PlaneGeometry(leafWidth, leafLen, 4, 12);
        
        // Thin-film interference shader simulation using MeshPhysicalMaterial
        // with high iridescence and low thickness
        const hue = (i / leafCount) * 0.3; // Spread hues
        const leafColor = new THREE.Color().setHSL(0.55 + hue, 0.8, 0.6);
        
        const leafMat = new THREE.MeshPhysicalMaterial({
            color: leafColor,
            roughness: 0.1,
            metalness: 0.0,
            transmission: 0.6, // Partially transparent
            thickness: 0.1,    // Thin film
            ior: 1.5,          // Index of refraction
            iridescence: 1.0,  // Maximum iridescence
            iridescenceIOR: 1.8,
            iridescenceThicknessRange: [100, 400], // nm range for color shifting
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        registerReactiveMaterial(leafMat);

        const leaf = new THREE.Mesh(leafGeo, leafMat);
        
        // Position leaf extending outward from pod
        leaf.position.y = leafLen / 2 + 0.8; // Start from pod surface
        leafGroup.add(leaf);
        
        // Rotate around pod
        const angle = (i / leafCount) * Math.PI * 2;
        leafGroup.rotation.y = angle;
        leafGroup.rotation.z = Math.PI / 6 + Math.random() * 0.2; // Slight outward angle
        
        // Store leaf animation data
        leafGroup.userData = {
            index: i,
            baseAngleZ: leafGroup.rotation.z,
            unfoldProgress: 0, // 0 = folded, 1 = fully unfolded
            phaseOffset: Math.random() * Math.PI * 2,
            rippleSpeed: 0.5 + Math.random() * 0.5,
            leaf: leaf
        };

        leaves.push(leafGroup);
        group.add(leafGroup);
    }

    // Store group data for animation
    group.userData = {
        type: 'solarSail',
        animationType: 'solarSail',
        animationOffset: Math.random() * 10,
        leaves: leaves,
        pod: pod,
        podGlow: podGlow,
        isUnfolded: false,
        unfoldProgress: 0,
        nearLightSource: false
    };

    return group;
}

/**
 * Update Solar Sail animation
 * - Rippling leaf effect
 * - Unfold/fold based on light proximity
 * - Iridescent color shifting
 */
export function updateSolarSail(solarSail: THREE.Group, delta: number, time: number, lightPosition: THREE.Vector3 | null = null) {
    if (!solarSail.userData || solarSail.userData.type !== 'solarSail') return;

    const data = solarSail.userData;
    const leaves = data.leaves;

    // Check distance to light source for unfolding
    let targetUnfold = 0.3; // Default partially folded
    if (lightPosition) {
        const distance = solarSail.position.distanceTo(lightPosition);
        const maxDistance = 100;
        if (distance < maxDistance) {
            targetUnfold = 1.0 - (distance / maxDistance) * 0.7;
        }
    } else {
        // Default slow unfold animation
        targetUnfold = 0.5 + Math.sin(time * 0.2 + data.animationOffset) * 0.3;
    }

    // Smooth unfold transition
    data.unfoldProgress += (targetUnfold - data.unfoldProgress) * delta * 2;

    // Animate each leaf
    leaves.forEach((leafGroup: THREE.Group, i: number) => {
        const leafData = leafGroup.userData;
        const leaf = leafData.leaf;

        // Unfold angle (more horizontal when unfolded)
        const unfoldAngle = Math.PI / 2 - (Math.PI / 3) * data.unfoldProgress;
        leafGroup.rotation.z = leafData.baseAngleZ * (1 - data.unfoldProgress) + unfoldAngle * data.unfoldProgress;

        // Ripple effect on leaf geometry
        if (leaf && leaf.geometry) {
            const positions = leaf.geometry.attributes.position;
            const waveTime = time * leafData.rippleSpeed + leafData.phaseOffset;
            
            for (let j = 0; j < positions.count; j++) {
                const y = positions.getY(j);
                const normalizedY = (y / (leaf.geometry.parameters.height / 2)); // -1 to 1
                
                // Wave amplitude increases toward tip
                const waveAmplitude = 0.1 * Math.abs(normalizedY) * data.unfoldProgress;
                const wave = Math.sin(waveTime * 3 + normalizedY * 4) * waveAmplitude;
                
                positions.setZ(j, wave);
            }
            positions.needsUpdate = true;
            leaf.geometry.computeVertexNormals();
        }

        // Throttle material updates (only update every ~0.1 seconds) to reduce GPU state changes
        // Using time modulo to spread updates across frames
        const shouldUpdateMaterial = Math.floor(time * 10) % 3 === (i % 3);
        if (shouldUpdateMaterial && leaf && leaf.material) {
            const shimmer = Math.sin(time * 2 + i) * 0.2 + 0.8;
            leaf.material.iridescenceIOR = 1.5 + shimmer * 0.5;
        }
    });

    // Pod glow pulse
    if (data.podGlow) {
        const pulse = Math.sin(time * 1.5 + data.animationOffset) * 0.5 + 0.5;
        data.podGlow.material.opacity = 0.1 + pulse * 0.15 * data.unfoldProgress;
        data.podGlow.scale.setScalar(1 + pulse * 0.1);
    }

    // Slow rotation
    solarSail.rotation.y += delta * 0.1;
}

// --- Instancing System (Grass) ---
let grassMeshes: THREE.InstancedMesh[] = [];
