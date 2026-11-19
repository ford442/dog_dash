import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, materialColor, materialEmissive, mix, vertexColor } from 'three/tsl';
import { createClayMaterial, foliageMaterials, reactiveMaterials, registerReactiveMaterial } from '../foliage_shared';
import {
    CLOUD_BASE_Y,
    FOLIAGE_VARIANTS,
    getBalloonBushBaseGeometry,
    getBalloonGeometry,
    getCloudGeometry,
    getSeedPodGeometry,
    getShrubFlowerGeometry,
    getShrubLeafGeometry,
    getTreeBlossomGeometry,
    getTreeWoodGeometry
} from '../scenery_art/foliage_shapes';
export { reactiveMaterials };

// --- STANDARD PLANTS ---

export function createGrass(options: any = {}) {
    const { color = 0x7CFC00, shape = 'tall' } = options;
    const material = createClayMaterial(color);
    let geo;
    if (shape === 'tall') {
        const height = 0.5 + Math.random();
        geo = new THREE.BoxGeometry(0.05, height, 0.05);
        geo.translate(0, height / 2, 0);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            if (y > height * 0.5) {
                const bendFactor = (y - height * 0.5) / (height * 0.5);
                pos.setX(i, pos.getX(i) + bendFactor * 0.1);
            }
        }
    } else if (shape === 'bushy') {
        const height = 0.2 + Math.random() * 0.3;
        geo = new THREE.CylinderGeometry(0.1, 0.05, height, 8);
        geo.translate(0, height / 2, 0);
    } else {
        geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    }
    geo.computeVertexNormals();

    const blade = new THREE.Mesh(geo, material);
    blade.castShadow = true;
    blade.userData.type = 'grass';
    blade.userData.animationType = shape === 'tall' ? 'sway' : 'bounce';
    blade.userData.animationOffset = Math.random() * 10;
    return blade;
}

export function createFlower(options: any = {}) {
    const { color = null, shape = 'simple' } = options;
    const group = new THREE.Group();

    const stemHeight = 0.6 + Math.random() * 0.4;
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, stemHeight, 6);
    stemGeo.translate(0, stemHeight / 2, 0);
    const stem = new THREE.Mesh(stemGeo, foliageMaterials.flowerStem);
    stem.castShadow = true;
    group.add(stem);

    const head = new THREE.Group();
    head.position.y = stemHeight;
    group.add(head);

    const centerGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const center = new THREE.Mesh(centerGeo, foliageMaterials.flowerCenter);
    center.name = 'flowerCenter';
    head.add(center);

    let petalMat;
    if (color) {
        petalMat = createClayMaterial(color);
        registerReactiveMaterial(petalMat);
    } else {
        petalMat = foliageMaterials.flowerPetal[Math.floor(Math.random() * foliageMaterials.flowerPetal.length)];
    }

    if (shape === 'simple') {
        const petalCount = 5 + Math.floor(Math.random() * 2);
        const petalGeo = new THREE.IcosahedronGeometry(0.15, 0);
        petalGeo.scale(1, 0.5, 1);
        for (let i = 0; i < petalCount; i++) {
            const angle = (i / petalCount) * Math.PI * 2;
            const petal = new THREE.Mesh(petalGeo, petalMat);
            petal.position.set(Math.cos(angle) * 0.18, 0, Math.sin(angle) * 0.18);
            petal.rotation.z = Math.PI / 4;
            head.add(petal);
        }
    } else if (shape === 'multi') {
        const petalCount = 8 + Math.floor(Math.random() * 4);
        const petalGeo = new THREE.SphereGeometry(0.12, 8, 8);
        for (let i = 0; i < petalCount; i++) {
            const angle = (i / petalCount) * Math.PI * 2;
            const petal = new THREE.Mesh(petalGeo, petalMat);
            petal.position.set(Math.cos(angle) * 0.2, Math.sin(i * 0.5) * 0.1, Math.sin(angle) * 0.2);
            head.add(petal);
        }
    } else if (shape === 'layered') {
        for (let layer = 0; layer < 2; layer++) {
            const petalCount = 6;
            const petalGeo = new THREE.IcosahedronGeometry(0.12, 0);
            petalGeo.scale(1, 0.5, 1);
            const layerColor = layer === 0 ? petalMat : createClayMaterial(color ? color + 0x111111 : 0xFFD700);
            if (layer !== 0) registerReactiveMaterial(layerColor);

            for (let i = 0; i < petalCount; i++) {
                const angle = (i / petalCount) * Math.PI * 2 + (layer * Math.PI / petalCount);
                const petal = new THREE.Mesh(petalGeo, layerColor);
                petal.position.set(
                    Math.cos(angle) * (0.15 + layer * 0.05),
                    layer * 0.05,
                    Math.sin(angle) * (0.15 + layer * 0.05)
                );
                petal.rotation.z = Math.PI / 4;
                head.add(petal);
            }
        }
    }

    if (Math.random() > 0.5) {
        const beamGeo = new THREE.ConeGeometry(0.1, 1, 8, 1, true);
        beamGeo.translate(0, 0.5, 0);
        const beamMat = foliageMaterials.lightBeam.clone();
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = stemHeight;
        beam.userData.isBeam = true;
        group.add(beam);
    }

    group.userData.animationOffset = Math.random() * 10;
    group.userData.animationType = 'sway';
    group.userData.type = 'flower';
    group.userData.isFlower = true;
    return group;
}

/** Pick one of the shared foliage variants (visual-only). */
function pickVariant(): number {
    return Math.floor(Math.random() * FOLIAGE_VARIANTS); // visual-only
}

/** Clay material that takes the merged geometry's vertex shading (and its own colour). */
function vertexClay(color: number, opts: { doubleSide?: boolean } = {}): THREE.MeshStandardMaterial {
    const mat = createClayMaterial(color);
    mat.vertexColors = true;
    if (opts.doubleSide) mat.side = THREE.DoubleSide;
    return mat;
}

/**
 * Flowering tree (#418): forked trunk with branches into lumpy blossom
 * clumps (petal speckle), two merged shared meshes.
 */
export function createFloweringTree(options: any = {}) {
    const { color = 0xFF69B4 } = options;
    const group = new THREE.Group();
    const variant = pickVariant();

    const wood = new THREE.Mesh(getTreeWoodGeometry(variant), vertexClay(0x8B5A2B));
    wood.castShadow = true;
    group.add(wood);

    const bloomMat = vertexClay(color);
    registerReactiveMaterial(bloomMat);
    const bloom = new THREE.Mesh(getTreeBlossomGeometry(variant), bloomMat);
    bloom.castShadow = true;
    group.add(bloom);

    group.scale.setScalar(0.9 + Math.random() * 0.25); // visual-only
    group.rotation.y = Math.random() * Math.PI * 2; // visual-only
    group.userData.animationType = 'gentleSway';
    group.userData.animationOffset = Math.random() * 10; // visual-only
    group.userData.type = 'tree';
    return group;
}

/**
 * Shrub (#418): leaf dome ringed by folded leaf blades, topped with
 * five-petal flowers. Two merged shared meshes (was a sphere + one sphere
 * per flower).
 */
export function createShrub(options: any = {}) {
    const { color = 0x32CD32 } = options;
    const group = new THREE.Group();
    const variant = pickVariant();

    const leaves = new THREE.Mesh(getShrubLeafGeometry(variant), vertexClay(color, { doubleSide: true }));
    leaves.castShadow = true;
    group.add(leaves);

    const flowerMat = vertexClay(0xFF69B4, { doubleSide: true });
    registerReactiveMaterial(flowerMat);
    group.add(new THREE.Mesh(getShrubFlowerGeometry(variant), flowerMat));

    group.scale.setScalar(0.85 + Math.random() * 0.35); // visual-only
    group.rotation.y = Math.random() * Math.PI * 2; // visual-only
    group.userData.animationType = 'bounce';
    group.userData.animationOffset = Math.random() * 10; // visual-only
    group.userData.type = 'shrub';
    return group;
}

export function createGlowingFlower(options: any = {}) {
    const { color = 0xFFD700, intensity = 1.5 } = options;
    const group = new THREE.Group();

    const stemHeight = 0.6 + Math.random() * 0.4;
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, stemHeight, 6);
    stemGeo.translate(0, stemHeight / 2, 0);
    const stem = new THREE.Mesh(stemGeo, foliageMaterials.flowerStem);
    stem.castShadow = true;
    group.add(stem);

    const headGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: intensity,
        roughness: 0.8
    });
    registerReactiveMaterial(headMat);

    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = stemHeight;
    group.add(head);

    const washGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const wash = new THREE.Mesh(washGeo, foliageMaterials.lightBeam);
    wash.position.y = stemHeight;
    wash.userData.isWash = true;
    group.add(wash);

    group.userData.animationType = 'glowPulse';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'flower';
    return group;
}

/**
 * Floating orb (#418): a glowing seed pod cupped by leaf sepals with a stem
 * curl. One merged mesh; only the bulb (`aMask`) glows, and it still takes
 * the reactive emissive the music drives.
 */
export function createFloatingOrb(options: any = {}) {
    const { color = 0x87CEEB, size = 0.5 } = options;
    const mat = new MeshStandardNodeMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.6 });
    // No `vertexColors`: the colorNode below already reads the vertex colour (the flag would multiply it in twice).
    mat.side = THREE.DoubleSide;
    const bulb = attribute('aMask', 'float');
    // Leaves take their vertex green; the bulb takes the orb colour and the (music-reactive) emissive.
    mat.colorNode = mix(vertexColor(), materialColor, bulb);
    mat.emissiveNode = materialEmissive.mul(bulb);
    registerReactiveMaterial(mat);

    const orb = new THREE.Mesh(getSeedPodGeometry(), mat);
    orb.scale.setScalar(size);
    orb.castShadow = true;
    orb.userData.animationType = 'float';
    orb.userData.animationOffset = Math.random() * 10; // visual-only
    orb.userData.type = 'orb';
    return orb;
}

export function createVine(options: any = {}) {
    const { color = 0x228B22, length = 3 } = options;
    const group = new THREE.Group();

    for (let i = 0; i < length; i++) {
        const segmentGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
        const segment = new THREE.Mesh(segmentGeo, createClayMaterial(color));
        segment.position.y = i * 0.5;
        segment.rotation.z = Math.sin(i * 0.5) * 0.2;
        group.add(segment);
    }

    group.userData.animationType = 'vineSway';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'vine';
    return group;
}

export function createLeafParticle(options: any = {}) {
    const { color = 0x00ff00 } = options;
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.1, 0.1, 0, 0.2);
    leafShape.quadraticCurveTo(-0.1, 0.1, 0, 0);
    const geo = new THREE.ShapeGeometry(leafShape);
    const mat = createClayMaterial(color);
    const leaf = new THREE.Mesh(geo, mat);
    leaf.castShadow = true;
    return leaf;
}

export function createStarflower(options: any = {}) {
    const { color = 0xFF6EC7 } = options;
    const group = new THREE.Group();

    const stemH = 0.7 + Math.random() * 0.4;
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, stemH, 6);
    stemGeo.translate(0, stemH / 2, 0);
    const stem = new THREE.Mesh(stemGeo, createClayMaterial(0x228B22));
    stem.castShadow = true;
    group.add(stem);

    const center = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), foliageMaterials.flowerCenter);
    center.position.y = stemH;
    group.add(center);

    const petalGeo = new THREE.ConeGeometry(0.09, 0.2, 6);
    const petalMat = createClayMaterial(color);
    registerReactiveMaterial(petalMat);

    const petalCount = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < petalCount; i++) {
        const petal = new THREE.Mesh(petalGeo, petalMat);
        const angle = (i / petalCount) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.16, stemH, Math.sin(angle) * 0.16);
        petal.rotation.x = Math.PI * 0.5;
        petal.rotation.z = angle;
        group.add(petal);
    }

    const beamGeo = new THREE.ConeGeometry(0.02, 8, 8, 1, true);
    beamGeo.translate(0, 4, 0);
    const beamMat = foliageMaterials.lightBeam.clone();
    beamMat.color.setHex(color);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = stemH;
    beam.userData.isBeam = true;
    group.add(beam);

    group.userData.animationType = 'spin';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'starflower';
    return group;
}

export function createBellBloom(options: any = {}) {
    const { color = 0xFFD27F } = options;
    const group = new THREE.Group();

    const stemH = 0.4 + Math.random() * 0.2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, stemH, 6), createClayMaterial(0x2E8B57));
    stem.castShadow = true;
    stem.position.y = 0;
    group.add(stem);

    const petalGeo = new THREE.ConeGeometry(0.12, 0.28, 10);
    const petalMat = createClayMaterial(color);
    registerReactiveMaterial(petalMat);

    const petals = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < petals; i++) {
        const p = new THREE.Mesh(petalGeo, petalMat);
        const angle = (i / petals) * Math.PI * 2;
        p.position.set(Math.cos(angle) * 0.08, -0.08, Math.sin(angle) * 0.08);
        p.rotation.x = Math.PI;
        p.castShadow = true;
        group.add(p);
    }

    group.userData.animationType = 'sway';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'flower';
    return group;
}

export function createWisteriaCluster(options: any = {}) {
    const { color = 0xCFA0FF, strands = 4 } = options;
    const group = new THREE.Group();

    const bloomMat = createClayMaterial(color);
    registerReactiveMaterial(bloomMat);

    for (let s = 0; s < strands; s++) {
        const strand = new THREE.Group();
        const length = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < length; i++) {
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), createClayMaterial(0x2E8B57));
            seg.position.y = -i * 0.35;
            seg.rotation.z = Math.sin(i * 0.5) * 0.15;
            strand.add(seg);

            if (i > 0 && Math.random() > 0.6) {
                const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), bloomMat);
                b.position.y = seg.position.y - 0.1;
                b.position.x = (Math.random() - 0.5) * 0.06;
                b.position.z = (Math.random() - 0.5) * 0.06;
                strand.add(b);
            }
        }
        strand.position.x = (Math.random() - 0.5) * 0.6;
        strand.position.y = 0;
        group.add(strand);
    }

    group.userData.animationType = 'vineSway';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'vine';
    return group;
}

export function createBubbleWillow(options: any = {}) {
    const { color = 0x8A2BE2 } = options;
    const group = new THREE.Group();

    const trunkH = 2.5 + Math.random();
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, trunkH, 12);
    const trunk = new THREE.Mesh(trunkGeo, createClayMaterial(0x5D4037));
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    const branchCount = 6 + Math.floor(Math.random() * 4);
    const branchMat = createClayMaterial(color);
    registerReactiveMaterial(branchMat);

    for (let i = 0; i < branchCount; i++) {
        const branchGroup = new THREE.Group();
        branchGroup.position.y = trunkH * 0.9;
        branchGroup.rotation.y = (i / branchCount) * Math.PI * 2;

        const length = 1.5 + Math.random();
        const capsuleGeo = new THREE.CapsuleGeometry(0.2, length, 8, 16);
        const capsule = new THREE.Mesh(capsuleGeo, branchMat);

        capsule.position.set(0.5, -length / 2, 0);
        capsule.rotation.z = -Math.PI / 6;

        branchGroup.add(capsule);
        group.add(branchGroup);
    }

    group.userData.animationType = 'gentleSway';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'tree';
    return group;
}

export function createPuffballFlower(options: any = {}) {
    const { color = 0xFF69B4 } = options;
    const group = new THREE.Group();

    const stemH = 1.0 + Math.random() * 0.5;
    const stemGeo = new THREE.CylinderGeometry(0.1, 0.12, stemH, 8);
    const stem = new THREE.Mesh(stemGeo, createClayMaterial(0x6B8E23));
    stem.position.y = stemH / 2;
    stem.castShadow = true;
    group.add(stem);

    const headR = 0.4 + Math.random() * 0.2;
    const headGeo = new THREE.SphereGeometry(headR, 16, 16);
    const headMat = createClayMaterial(color);
    registerReactiveMaterial(headMat);

    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = stemH;
    head.castShadow = true;
    group.add(head);

    const sporeCount = 4 + Math.floor(Math.random() * 4);
    const sporeGeo = new THREE.SphereGeometry(headR * 0.3, 8, 8);
    const sporeMat = createClayMaterial(color + 0x111111);
    registerReactiveMaterial(sporeMat);

    for (let i = 0; i < sporeCount; i++) {
        const spore = new THREE.Mesh(sporeGeo, sporeMat);
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);

        spore.position.set(x * headR, stemH + y * headR, z * headR);
        group.add(spore);
    }

    group.userData.animationType = 'sway';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'flower';
    return group;
}

/**
 * Balloon bush (#418): a leafy base with balloons on strings (knots and
 * all). Two merged shared meshes (was 5–9 loose spheres).
 */
export function createBalloonBush(options: any = {}) {
    const { color = 0xFF4500 } = options;
    const group = new THREE.Group();
    const variant = pickVariant();

    const base = new THREE.Mesh(getBalloonBushBaseGeometry(variant), vertexClay(0x3fae55, { doubleSide: true }));
    base.castShadow = true;
    group.add(base);

    const mat = vertexClay(color);
    registerReactiveMaterial(mat);
    const balloons = new THREE.Mesh(getBalloonGeometry(variant), mat);
    balloons.castShadow = true;
    group.add(balloons);

    group.rotation.y = Math.random() * Math.PI * 2; // visual-only
    group.userData.animationType = 'bounce';
    group.userData.animationOffset = Math.random() * 10; // visual-only
    group.userData.type = 'shrub';
    return group;
}

/**
 * Raining cloud (#418): a row of puffs with a flat, darker base (one merged
 * shared mesh) and the rain below. Keep the rain at `children[1]`: the
 * 'rain' animation in `grass_system.ts` reads it there.
 */
export function createRainingCloud(options: any = {}) {
    const { color = 0xB0C4DE, rainIntensity = 50 } = options;
    const group = new THREE.Group();

    const cloud = new THREE.Mesh(getCloudGeometry(pickVariant()), vertexClay(color));
    cloud.castShadow = true;
    group.add(cloud);

    const rainGeo = new THREE.BufferGeometry();
    const rainCount = rainIntensity;
    const positions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 3; // visual-only
        positions[i * 3 + 1] = CLOUD_BASE_Y - Math.random() * 2; // visual-only
        positions[i * 3 + 2] = (Math.random() - 0.5) * 1.2; // visual-only
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.PointsMaterial({ color: 0x87CEEB, size: 0.05 });
    const rain = new THREE.Points(rainGeo, rainMat);
    group.add(rain);

    group.userData.animationType = 'rain';
    group.userData.animationOffset = Math.random() * 10; // visual-only
    group.userData.type = 'cloud';
    return group;
}

export function createGlowingFlowerPatch(x: number, z: number) {
    const patch = new THREE.Group();
    patch.position.set(x, 0, z);
    for (let i = 0; i < 5; i++) {
        const gf = createGlowingFlower();
        gf.position.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 1);
        patch.add(gf);
    }
    return patch;
}

export function createFloatingOrbCluster(x: number, z: number) {
    const cluster = new THREE.Group();
    cluster.position.set(x, 5, z);
    for (let i = 0; i < 3; i++) {
        const orb = createFloatingOrb();
        orb.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        cluster.add(orb);
    }
    return cluster;
}

export function createVineCluster(x: number, z: number) {
    const cluster = new THREE.Group();
    cluster.position.set(x, 0, z);
    for (let i = 0; i < 3; i++) {
        const vine = createVine();
        vine.position.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        cluster.add(vine);
    }
    return cluster;
}

export function createPrismRoseBush(options: any = {}) {
    const group = new THREE.Group();

    const stemsMat = createClayMaterial(0x5D4037);
    const baseHeight = 1.0 + Math.random() * 0.5;

    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, baseHeight, 8);
    trunkGeo.translate(0, baseHeight / 2, 0);
    const trunk = new THREE.Mesh(trunkGeo, stemsMat);
    trunk.castShadow = true;
    group.add(trunk);

    const branchCount = 3 + Math.floor(Math.random() * 3);
    const roseColors = [0xFF0055, 0xFFAA00, 0x00CCFF, 0xFF00FF, 0x00FF88];

    for (let i = 0; i < branchCount; i++) {
        const branchGroup = new THREE.Group();
        branchGroup.position.y = baseHeight * 0.8;
        branchGroup.rotation.y = (i / branchCount) * Math.PI * 2;
        branchGroup.rotation.z = Math.PI / 4;

        const branchLen = 0.8 + Math.random() * 0.5;
        const branchGeo = new THREE.CylinderGeometry(0.08, 0.1, branchLen, 6);
        branchGeo.translate(0, branchLen / 2, 0);
        const branch = new THREE.Mesh(branchGeo, stemsMat);
        branchGroup.add(branch);

        const roseGroup = new THREE.Group();
        roseGroup.position.y = branchLen;

        const color = roseColors[Math.floor(Math.random() * roseColors.length)];
        const petalMat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            emissive: 0x000000,
            emissiveIntensity: 0.0
        });
        registerReactiveMaterial(petalMat);

        const outerGeo = new THREE.TorusKnotGeometry(0.25, 0.08, 64, 8, 2, 3);
        const outer = new THREE.Mesh(outerGeo, petalMat);
        outer.scale.set(1, 0.6, 1);
        roseGroup.add(outer);

        const innerGeo = new THREE.SphereGeometry(0.15, 16, 16);
        const inner = new THREE.Mesh(innerGeo, petalMat);
        inner.position.y = 0.05;
        roseGroup.add(inner);

        const washGeo = new THREE.SphereGeometry(1.2, 16, 16);
        const washMat = foliageMaterials.lightBeam.clone();
        washMat.color.setHex(color);
        const wash = new THREE.Mesh(washGeo, washMat);
        wash.userData.isWash = true;
        roseGroup.add(wash);

        branchGroup.add(roseGroup);
        group.add(branchGroup);
    }

    group.userData.animationType = 'sway';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'flower';

    return group;
}

// --- MISSING SPECIAL PLANTS RESTORED ---

/**
 * 1. The Subwoofer Lotus
 * Hovering lily pad that acts as a speaker cone.
 */
