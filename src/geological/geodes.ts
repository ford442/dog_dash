import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial
} from 'three/webgpu';
import { createIridescentCrystal } from '../candy_materials';
import {
    time,
    positionLocal,
    normalLocal,
    uv,
    vec2,
    vec3,
    vec4,
    color,
    uniform,
    mix,
    sin,
    cos,
    float,
    texture,
    normalMap,
    instanceIndex,
    distance,
    smoothstep,
    dot,
    fract,
    floor,
    clamp,
    step,
    pow
} from 'three/tsl';
import { ParticleSystem } from '../particles';
import { disposeObject } from '../utils';
import type { TSLNode } from '../tsl_types';
import { jellyMossSoftBody } from '../jelly_moss_softbody';

// --- TSL Noise Functions (3D) ---

const random3D = (v: any) => {
    return sin(dot(v, vec3(12.9898, 78.233, 37.719))).mul(43758.5453).fract();
};

const valueNoise3D = (v: any) => {
    const i = v.floor();
    const f = v.fract();

    // 8 corners
    const a = random3D(i);
    const b = random3D(i.add(vec3(1.0, 0.0, 0.0)));
    const c = random3D(i.add(vec3(0.0, 1.0, 0.0)));
    const d = random3D(i.add(vec3(1.0, 1.0, 0.0)));
    const e = random3D(i.add(vec3(0.0, 0.0, 1.0)));
    const f_ = random3D(i.add(vec3(1.0, 0.0, 1.0)));
    const g = random3D(i.add(vec3(0.0, 1.0, 1.0)));
    const h = random3D(i.add(vec3(1.0, 1.0, 1.0)));

    // Smooth interpolation curve
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

    // Mix X
    const mixX1 = mix(a, b, u.x);
    const mixX2 = mix(c, d, u.x);
    const mixX3 = mix(e, f_, u.x);
    const mixX4 = mix(g, h, u.x);

    // Mix Y
    const mixY1 = mix(mixX1, mixX2, u.y);
    const mixY2 = mix(mixX3, mixX4, u.y);

    // Mix Z
    return mix(mixY1, mixY2, u.z);
};

export const fbm = (v: any) => {
    let total: TSLNode = float(0.0);
    let amplitude: TSLNode = float(0.5);
    let frequency: TSLNode = float(1.0);

    // 3 Octaves
    total = total.add(valueNoise3D(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise3D(v.mul(frequency)).mul(amplitude));
    frequency = frequency.mul(2.0);
    amplitude = amplitude.mul(0.5);

    total = total.add(valueNoise3D(v.mul(frequency)).mul(amplitude));

    return total;
};

// --- GEOLOGICAL OBJECTS ---


// 2. FRACTURED GEODE (Safe harbors with EM fields)
export function createFracturedGeode(config: { size: number }) {
    const group = new THREE.Group();
    
    // Outer Shell (Dark rock)
    const shellGeo = new THREE.IcosahedronGeometry(config.size, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const shell = new THREE.Mesh(shellGeo, rockMat);
    group.add(shell);

    // Inner Core (Multiple Glowing Crystals)
    const coreMat = createIridescentCrystal(0x8844ff, 0.9, {
        emissiveIntensity: 0.35,
        cacheKey: 'geode_core'
    });

    const coreGroup = new THREE.Group();
    const crystalCount = 5;
    for (let i = 0; i < crystalCount; i++) {
        const crystalGeo = new THREE.OctahedronGeometry(config.size * 0.3, 0);
        const crystal = new THREE.Mesh(crystalGeo, coreMat);

        // Position crystals around center
        const angle = (i / crystalCount) * Math.PI * 2;
        const radius = config.size * 0.4;
        crystal.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * radius, Math.sin(angle) * radius);
        crystal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        coreGroup.add(crystal);
    }
    group.add(coreGroup);

    // EM Field (Transparent Sphere)
    const fieldGeo = new THREE.SphereGeometry(config.size * 2.5, 32, 32);
    const fieldMat = new THREE.MeshBasicMaterial({
        color: 0x8844ff,
        transparent: true,
        opacity: 0.1,
        wireframe: true
    });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    group.add(field);

    group.userData.isGeode = true;
    group.userData.fieldRadius = config.size * 2.5;
    group.userData.health = 100;
    group.userData.maxHealth = 100;
    group.userData.quality = 0.5 + Math.random() * 0.5; // Random initial quality between 0.5 and 1.0
    group.userData.isDischarged = false;
    group.userData.crystalCount = crystalCount;

    return group;
}

export function updateGeode(group: THREE.Group, delta: number, timeVal: number) {
    if (group.userData.isDischarged) return;

    // Rotate core Group
    const coreGroup = group.children[1];
    if (coreGroup) {
        coreGroup.rotation.y -= delta * 0.5;
        coreGroup.rotation.z += delta * 0.2;
    }

    // Pulse field opacity
    const field = group.children[2] as THREE.Mesh;
    if (field) {
        (field.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(timeVal * 2) * 0.05;
        field.rotation.y += delta * 0.1;
    }
}

export function damageGeode(group: THREE.Group, amount: number): boolean {
    if (group.userData.isDischarged) return false;

    group.userData.health -= amount;

    // Note: Quality remains static so it can be used for reward calculation upon depletion

    // Visually remove/shrink crystals based on health
    const coreGroup = group.children[1] as THREE.Group;
    if (coreGroup) {
        const activeCrystals = Math.ceil((group.userData.health / group.userData.maxHealth) * group.userData.crystalCount);
        for (let i = 0; i < coreGroup.children.length; i++) {
            if (i >= activeCrystals) {
                coreGroup.children[i].visible = false;
            } else {
                // Shrink remaining slightly
                const scale = 0.5 + 0.5 * (group.userData.health / group.userData.maxHealth);
                coreGroup.children[i].scale.setScalar(scale);
            }
        }
    }

    if (group.userData.health <= 0) {
        group.userData.isDischarged = true;

        // Hide EM field
        const field = group.children[2] as THREE.Mesh;
        if (field) {
            field.visible = false;
        }
        return true; // Indicates just depleted
    }

    return false;
}



// 3. NEBULA JELLY-MOSS (Advanced Behavior)
export function createNebulaJellyMoss(config: { size: number }) {
    // High-res geometry for vertex shader displacement (Optimized from 128)
    const geo = new THREE.SphereGeometry(config.size, 64, 64);
    
    // TSL Material for Membrane with Vertex Wobble
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x00ff88,
        transmission: 0.9,
        opacity: 1.0,
        metalness: 0.0,
        roughness: 0.1,
        ior: 1.5,
        thickness: 2.0,
        side: THREE.DoubleSide
    });

    // Uniforms
    const uTime = time;
    const uOverload = uniform(0.0); // 0.0 to 1.0 (Destruction buildup)

    const pos = positionLocal;
    const norm = normalLocal;

    // --- Advanced Membrane Physics ---
    // Use 3D Noise for organic displacement
    const noiseFreq = float(1.0);
    const noiseAmp = float(config.size * 0.2); // 20% surface wobble

    // Animate noise domain
    // Normal wobble speed
    const baseSpeed = vec3(0.5, 0.8, 0.3).mul(uTime);
    // Overload wobble speed (much faster/chaotic)
    const overloadSpeed = vec3(5.0, 8.0, 3.0).mul(uTime);

    // Mix speed based on overload
    const currentSpeed = mix(baseSpeed, overloadSpeed, uOverload);

    const noisePos = pos.mul(noiseFreq).add(currentSpeed);
    const noiseVal = fbm(noisePos); // -1 to 1 approx

    // Calculate displacement
    // Base amplitude increases with overload
    const currentAmp = mix(noiseAmp, noiseAmp.mul(3.0), uOverload.mul(uOverload)); // Quadratic ramp up

    const displacement = norm.mul(noiseVal.mul(currentAmp));

    // Add high-frequency jitter when overloading
    const jitter = sin(pos.mul(20.0).add(uTime.mul(50.0))).mul(uOverload.mul(0.5));
    const jitterDisp = norm.mul(jitter);

    mat.positionNode = pos.add(displacement).add(jitterDisp);

    // --- Emissive Pulse ---
    // Normal pulse
    const basePulse = sin(uTime.mul(2.0)).add(1.0).mul(0.5); // 0-1
    // Strobe pulse (fast flashing)
    const strobePulse = sin(uTime.mul(30.0)).add(1.0).mul(0.5); // 0-1

    // Mix color based on overload (Green -> White/Bright)
    const baseColor = color(0x00ff88);
    const overloadColor = color(0xffffff);
    const finalColor = mix(baseColor, overloadColor, uOverload);

    // Mix pulse intensity
    const intensity = mix(basePulse.mul(0.5), strobePulse.mul(5.0), uOverload);

    mat.emissiveNode = finalColor.mul(intensity);

    // Store uniform for JS access
    mat.userData = {
        uOverload: uOverload
    };

    const mesh = new THREE.Mesh(geo, mat);
    
    // Internal "Fractal Moss" Cores (Weak points)
    const coreGroup = new THREE.Group();
    const coreCount = 5 + Math.floor(Math.random() * 5);
    const coreGeo = new THREE.IcosahedronGeometry(config.size * 0.15, 0);
    const coreMat = new MeshStandardNodeMaterial({
        color: 0xff2266, // Pinkish red contrast
        emissive: 0x550022,
        roughness: 0.8
    });

    // Core pulse animation
    coreMat.emissiveNode = color(0xff2266).mul(sin(uTime.mul(5.0)).add(1.0).mul(0.5));

    for(let i=0; i<coreCount; i++) {
        const core = new THREE.Mesh(coreGeo, coreMat);
        // Distribute randomly inside
        const r = config.size * 0.6 * Math.cbrt(Math.random());
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        core.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        core.userData = { isWeakPoint: true };
        coreGroup.add(core);
    }
    mesh.add(coreGroup);

    mesh.userData = {
        type: 'nebulaJellyMoss',
        speciesId: 'nebulaJellyMoss',
        radius: config.size,
        health: 10,
        maxHealth: 10,
        isHiding: false,
        overloadValue: 0.0, // JS tracker
        hitCount: 0
    };

    return mesh;
}

export function updateNebulaJellyMoss(mesh: THREE.Mesh, delta: number, timeVal: number) {
    // Slow drift rotation of the entire organism
    mesh.rotation.x += delta * 0.05;
    mesh.rotation.z += delta * 0.03;
    
    // Rotate internal core structure
    if (mesh.children[0]) {
        mesh.children[0].rotation.y -= delta * 0.2;
        mesh.children[0].rotation.x += delta * 0.1;
    }
}

export function destroyNebulaJellyMoss(mesh: THREE.Mesh, scene: THREE.Scene, particleSystem: ParticleSystem) {
    jellyMossSoftBody.detach(mesh);

    // 1. Particle Burst
    // Emit green goo particles
    particleSystem.emit(mesh.position, 0x00ff88, 50, 8.0, 2.0, 3.0);
    // Emit red core particles
    particleSystem.emit(mesh.position, 0xff2266, 20, 12.0, 1.0, 2.0);

    // 2. Detach Cores (Collectibles)
    // The cores are in mesh.children[0] (coreGroup)
    const coreGroup = mesh.children[0] as THREE.Group;
    if (coreGroup) {
        // Clone positions to world space and re-add to scene as physics objects
        const children = [...coreGroup.children];
        children.forEach(core => {
            const worldPos = new THREE.Vector3();
            core.getWorldPosition(worldPos);

            // Re-parent to scene
            scene.add(core);
            core.position.copy(worldPos);

            // Add slight velocity/drift
            core.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5
            );
            core.userData.isCollectible = true; // Tag for main.ts loop

            // Animate scale down over time? Or keeping them as collectibles?
            // Let's keep them as collectibles that maybe fade out if not collected
            core.userData.life = 10.0;
        });
    }

    // 3. Remove Main Mesh
    scene.remove(mesh);
    disposeObject(mesh);
}


