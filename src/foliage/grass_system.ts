import * as THREE from 'three';
import { createClayMaterial, foliageMaterials, reactiveMaterials, registerReactiveMaterial } from '../foliage_shared';

const dummy = new THREE.Object3D();
const MAX_PER_MESH = 1000;

let grassMeshes: THREE.InstancedMesh[] = [];

export function initGrassSystem(scene: THREE.Scene, count: number = 5000) {
    grassMeshes = [];
    const height = 0.8;
    const geo = new THREE.BoxGeometry(0.05, height, 0.05);
    geo.translate(0, height / 2, 0);

    const mat = createClayMaterial(0x7CFC00);

    const meshCount = Math.ceil(count / MAX_PER_MESH);

    for (let i = 0; i < meshCount; i++) {
        const capacity = Math.min(MAX_PER_MESH, count - i * MAX_PER_MESH);
        const mesh = new THREE.InstancedMesh(geo, mat, capacity);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.count = 0;
        scene.add(mesh);
        grassMeshes.push(mesh);
    }

    return grassMeshes;
}

export function addGrassInstance(x: number, y: number, z: number) {
    const mesh = grassMeshes.find(m => m.count < m.instanceMatrix.count);
    if (!mesh) return;

    const index = mesh.count;

    dummy.position.set(x, y, z);
    dummy.rotation.y = Math.random() * Math.PI;
    const s = 0.8 + Math.random() * 0.4;
    dummy.scale.set(s, s, s);

    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.count++;
    mesh.instanceMatrix.needsUpdate = true;
}

// --- Animation System ---

function freqToHue(freq: number) {
    if (!freq || freq < 50) return 0;
    const logF = Math.log2(freq / 55.0);
    return (logF * 0.1) % 1.0;
}

export function updateFoliageMaterials(audioData: any, isNight: boolean) {
    if (!audioData) return;

    if (isNight) {
        const channels = audioData.channelData;
        if (!channels || channels.length === 0) return;

        // Helper to update a material list
        const updateMats = (mats: THREE.Material[], startCh: number) => {
            mats.forEach((mat: any, i) => {
                const chIndex = startCh + (i % 4);
                const ch = channels[Math.min(chIndex, channels.length - 1)];

                const trigger = ch?.trigger || 0;
                const volume = ch?.volume || 0;
                const freq = ch?.freq || 0;

                if (freq > 0) {
                    let targetHue = freqToHue(freq);
                    targetHue = (targetHue + i * 0.1) % 1.0;
                    const color = new THREE.Color().setHSL(targetHue, 1.0, 0.5);
                    mat.emissive.lerp(color, 0.3);
                } else {
                    mat.emissive.lerp(new THREE.Color(0x220044), 0.1);
                }

                const intensity = 0.2 + volume * 0.5 + trigger * 1.5;
                mat.emissiveIntensity = intensity;
            });
        };

        // 1. Update Petals and Custom Reactive Materials
        updateMats(foliageMaterials.flowerPetal as unknown as THREE.Material[], 1);
        updateMats(reactiveMaterials, 1);

        // 2. Flower Center (Contrast Blink)
        const melodyCh = channels[1];
        if (melodyCh && melodyCh.freq > 0) {
            let hue = freqToHue(melodyCh.freq);
            hue = (hue + 0.5) % 1.0; // Complementary color
            const centerColor = new THREE.Color().setHSL(hue, 1.0, 0.6);
            foliageMaterials.flowerCenter.emissive.lerp(centerColor, 0.2);
        } else {
            foliageMaterials.flowerCenter.emissive.lerp(new THREE.Color(0xFFFACD), 0.1);
        }
        foliageMaterials.flowerCenter.emissiveIntensity = 0.5 + audioData.kickTrigger * 2.0;

        // 3. Update Light Beams (Strobe/Wash)
        const beamMat = foliageMaterials.lightBeam;
        const kick = audioData.kickTrigger;
        const pan = channels[1]?.pan || 0;
        const beamHue = 0.6 + pan * 0.1;
        beamMat.color.setHSL(beamHue, 0.8, 0.8);

        let effectActive = 0;
        for (let c of channels) if (c.activeEffect > 0) effectActive = 1;

        let opacity = kick * 0.4;
        if (effectActive) {
            opacity += Math.random() * 0.3; // Flicker
        }
        beamMat.opacity = Math.max(0, Math.min(0.8, opacity));

        // 4. Grass (Chords)
        const chordVol = Math.max(channels[3]?.volume || 0, channels[4]?.volume || 0);
        const grassHue = 0.6 + chordVol * 0.1;
        foliageMaterials.grass.emissive.setHSL(grassHue, 0.8, 0.2);
        foliageMaterials.grass.emissiveIntensity = 0.2 + chordVol * 0.8;

    } else {
        const resetMats = (mats: THREE.Material[]) => {
            mats.forEach((mat: any) => {
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0;
            });
        };

        resetMats(foliageMaterials.flowerPetal as unknown as THREE.Material[]);
        resetMats(reactiveMaterials);

        foliageMaterials.flowerCenter.emissive.setHex(0x000000);
        foliageMaterials.flowerCenter.emissiveIntensity = 0;

        foliageMaterials.grass.emissive.setHex(0x000000);
        foliageMaterials.grass.emissiveIntensity = 0;

        foliageMaterials.lightBeam.opacity = 0;
    }
}

/**
 * Applies animations to foliage objects.
 */
export function animateFoliage(foliageObject: any, time: number, audioData: any, isDay: boolean) {
    const offset = foliageObject.userData.animationOffset || 0;
    const type = foliageObject.userData.animationType || 'sway';
    const plantType = foliageObject.userData.type;

    let groove = 0;
    let kick = 0;
    let beatPhase = 0;
    let bassVol = 0;
    let leadVol = 0;
    let chordVol = 0;

    if (audioData) {
        groove = audioData.grooveAmount || 0;
        kick = audioData.kickTrigger || 0;
        beatPhase = audioData.beatPhase || 0;
        if (audioData.channelData) {
            bassVol = audioData.channelData[0]?.volume || 0;
            leadVol = Math.max(audioData.channelData[1]?.volume || 0, audioData.channelData[2]?.volume || 0);
            chordVol = Math.max(audioData.channelData[3]?.volume || 0, audioData.channelData[4]?.volume || 0);
        }
    }

    const isNightDancer = (type === 'glowPulse' || plantType === 'starflower' || type === 'spin' || type === 'fiberWhip' || type === 'speakerPulse');
    let isActive = false;
    if (isNightDancer) {
        isActive = !isDay;
    } else {
        isActive = isDay;
    }

    let baseIntensity = isActive ? (1.0 + groove * 8.0) : 0.2;
    let squash = 1.0;
    let spin = 0.0;
    let wave = 0.0;

    if (isActive) {
        if (plantType === 'tree' || plantType === 'mushroom') squash = 1.0 + bassVol * 0.3;
        if (plantType === 'flower' || plantType === 'orb' || plantType === 'starflower') spin = leadVol * 5.0;
        if (plantType === 'grass' || plantType === 'vine' || plantType === 'shrub') wave = chordVol * 2.0;
    }

    const animTime = time + (beatPhase * 2.0);
    const intensity = baseIntensity + wave;

    if (foliageObject.userData.originalY === undefined) {
        foliageObject.userData.originalY = foliageObject.position.y;
    }
    const originalY = foliageObject.userData.originalY;

    // --- Special: Animate Light Beams/Wash ---
    if (foliageObject.userData.isFlower) {
        const melodyCh = audioData?.channelData?.[1];
        if (melodyCh && melodyCh.trigger) {
            const hue = freqToHue(melodyCh.freq);
            const center = foliageObject.getObjectByName('flowerCenter');
            if (center) {
                center.material.emissive.setHSL(hue, 1, 0.5);
            }
            const beam = foliageObject.getObjectByProperty('isBeam', true);
            if (beam) {
                beam.material.color.setHSL(hue, 1, 0.5);
                beam.material.opacity = 1.0;
                beam.scale.y = 10;
            }
        } else {
            const center = foliageObject.getObjectByName('flowerCenter');
            if (center) {
                center.material.emissive.setHSL(0, 0, 0);
            }
            const beam = foliageObject.getObjectByProperty('isBeam', true);
            if (beam) {
                beam.material.opacity *= 0.9;
                beam.scale.y *= 0.9;
            }
        }
    }

    if (plantType === 'tree' || plantType === 'mushroom') {
        if (squash > 1.01) foliageObject.scale.set(squash, 1.0 / squash, squash);
        else foliageObject.scale.set(1, 1, 1);
    }

    if (spin > 0) foliageObject.rotation.y += spin * 0.1;

    // --- RESTORED COMPLEX ANIMATIONS ---

    if (type === 'speakerPulse') {
        // Subwoofer Lotus
        foliageObject.position.y = originalY + Math.sin(time + offset) * 0.2;
        const pump = kick * 0.5;
        const pad = foliageObject.children[0];
        if (pad) {
            pad.scale.set(1.0 + pump * 0.2, 1.0 - pump * 0.5, 1.0 + pump * 0.2);
            // Light up rings if night
            if (!isDay && pad.userData.ringMaterial) {
                const ringMat = pad.userData.ringMaterial;
                const glow = pump * 5.0;
                ringMat.emissive.setHSL(0.0 + pump * 0.2, 1.0, 0.5);
                ringMat.emissiveIntensity = glow;
            }
        }

    } else if (type === 'accordionStretch') {
        // Accordion Palm
        const trunkGroup = foliageObject.userData.trunk;
        if (trunkGroup) {
            const stretch = 1.0 + Math.max(0, Math.sin(animTime * 10 + offset)) * 0.3 * intensity;
            trunkGroup.scale.y = stretch;
            const width = 1.0 / Math.sqrt(stretch);
            trunkGroup.scale.x = width;
            trunkGroup.scale.z = width;
        }

    } else if (type === 'fiberWhip') {
        // Fiber Optic Willow
        foliageObject.rotation.y = Math.sin(time * 0.5 + offset) * 0.1;
        const whip = leadVol * 2.0;
        foliageObject.children.forEach((branchGroup: any, i: number) => {
            if (branchGroup === foliageObject.children[0]) return; // Skip trunk
            const childOffset = i * 0.5;
            const cable = branchGroup.children[0];
            let rotZ = Math.PI / 4 + Math.sin(time * 2 + childOffset) * 0.1;
            if (!isDay) {
                rotZ += Math.sin(time * 10 + childOffset) * whip;
                const tip = cable.children[0];
                if (tip) tip.visible = Math.random() < (0.5 + whip);
            }
            if (cable) cable.rotation.z = rotZ;
        });

    } else if (type === 'sway' || type === 'gentleSway' || type === 'vineSway' || type === 'spin') {
        const t = animTime + offset;
        if (type === 'vineSway') {
            foliageObject.children.forEach((segment: any, i: number) => {
                segment.rotation.z = Math.sin(t * 2 + i * 0.5) * 0.2 * intensity;
            });
        } else {
            const tFinal = (plantType === 'tree') ? animTime : (time + offset);
            const speed = (plantType === 'tree') ? 1.0 : 2.0;

            if (type === 'spin') {
                foliageObject.rotation.y += 0.02 * intensity;
                foliageObject.rotation.z = Math.cos(time * 0.5 + offset) * 0.05 * intensity;
            } else {
                foliageObject.rotation.z = Math.sin(tFinal * speed + offset) * 0.05 * intensity;
                foliageObject.rotation.x = Math.cos(tFinal * speed * 0.8 + offset) * 0.05 * intensity;
            }
        }
    } else if (type === 'bounce') {
        foliageObject.position.y = originalY + Math.sin(animTime * 3 + offset) * 0.1 * intensity;
        if (isActive && kick > 0.1) foliageObject.position.y += kick * 0.2;

    } else if (type === 'glowPulse') {
        // ... (handled by material update mostly)
    } else if (type === 'float') {
        foliageObject.position.y = originalY + Math.sin(time * 1.5 + offset) * 0.2;
        if (!isDay && kick > 0.1) foliageObject.scale.setScalar(1.0 + kick * 0.2);

    } else if (type === 'spring') {
        foliageObject.scale.y = 1.0 + Math.sin(time * 3 + offset) * 0.1 * intensity + (kick * 0.5);

    } else if (type === 'rain') {
        const rain = foliageObject.children[1];
        if (rain) {
            const positions = rain.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                let y = positions.getY(i);
                y -= 0.1 + (kick * 0.2);
                if (y < -2) y = 0;
                positions.setY(i, y);
            }
            positions.needsUpdate = true;
        }
    }
}

// --- NEW PLANTS ---

export function createStarDustFern(options: any = {}) {
    const { color = 0x8A2BE2 } = options;
    const group = new THREE.Group();

    // Central small mound
    const moundGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const moundMat = createClayMaterial(0x4B0082); // Indigo
    const mound = new THREE.Mesh(moundGeo, moundMat);
    mound.position.y = 0.1;
    group.add(mound);

    // Fern fronds with stardust tips
    const frondCount = 6 + Math.floor(Math.random() * 4);
    const frondMat = createClayMaterial(color);
    registerReactiveMaterial(frondMat);

    const tipMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF }); // Glowing white tips

    for (let i = 0; i < frondCount; i++) {
        const frondGroup = new THREE.Group();
        const angle = (i / frondCount) * Math.PI * 2;
        frondGroup.rotation.y = angle;
        frondGroup.rotation.x = -Math.PI / 6; // Angle up slightly

        const length = 0.8 + Math.random() * 0.5;
        // Simple curved plane or series of small planes for the frond
        const frondGeo = new THREE.BoxGeometry(0.1, length, 0.02);
        frondGeo.translate(0, length / 2, 0);

        // Bend the frond
        const pos = frondGeo.attributes.position;
        for(let v = 0; v < pos.count; v++){
             const y = pos.getY(v);
             const z = pos.getZ(v);
             // Quadratic bend
             const bend = (y / length) * (y / length) * 0.5;
             pos.setZ(v, z - bend);
        }
        frondGeo.computeVertexNormals();

        const frond = new THREE.Mesh(frondGeo, frondMat);
        frondGroup.add(frond);

        // Stardust particles at the tip
        const particles = new THREE.Group();
        particles.position.set(0, length, -0.5); // End of bent frond
        for(let p=0; p<3; p++) {
            const particle = new THREE.Mesh(new THREE.DodecahedronGeometry(0.04, 0), tipMat);
            particle.position.set(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            particles.add(particle);
        }
        frondGroup.add(particles);

        group.add(frondGroup);
    }

    group.userData.animationType = 'gentleSway';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'fern';
    return group;
}

export function createNebulaRose(options: any = {}) {
    const { color = 0xFF1493 } = options; // Deep Pink
    const group = new THREE.Group();

    // Thorny stem
    const stemH = 1.2 + Math.random() * 0.5;
    const stemGeo = new THREE.CylinderGeometry(0.06, 0.08, stemH, 8);
    stemGeo.translate(0, stemH/2, 0);
    const stem = new THREE.Mesh(stemGeo, createClayMaterial(0x2F4F4F)); // Dark Slate Gray
    group.add(stem);

    // Rose Head
    const headGroup = new THREE.Group();
    headGroup.position.y = stemH;
    group.add(headGroup);

    const petalMat = createClayMaterial(color);
    registerReactiveMaterial(petalMat);

    // Layers of petals
    const layers = 3;
    for (let l = 0; l < layers; l++) {
        const count = 4 + l * 2;
        const radius = 0.15 + l * 0.1;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (l * 0.5);
            const petalGeo = new THREE.SphereGeometry(radius * 0.5, 8, 8);
            // Squish to make petal shape
            petalGeo.scale(1, 0.2, 1);

            const petal = new THREE.Mesh(petalGeo, petalMat);

            // Position in ring
            const x = Math.cos(angle) * radius * 0.6;
            const z = Math.sin(angle) * radius * 0.6;
            const y = l * 0.1;

            petal.position.set(x, y, z);

            // Rotate to face outward and up
            petal.lookAt(0, 0, 0);
            petal.rotation.x = -Math.PI / 4 - (l * 0.2); // Outer layers open more

            headGroup.add(petal);
        }
    }

    // Nebulous Gas (Translucent Sphere around the flower)
    const gasGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const gasMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const gas = new THREE.Mesh(gasGeo, gasMat);
    gas.position.y = 0.2;
    headGroup.add(gas);

    group.userData.animationType = 'sway';
    group.userData.animationOffset = Math.random() * 10;
    group.userData.type = 'flower';

    return group;
}
