import * as THREE from 'three';
import {
    MeshStandardNodeMaterial,
    MeshBasicNodeMaterial
} from 'three/webgpu';
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
    vec3,
    distance,
    smoothstep,
    dot,
    fract,
    floor,
    clamp,
    step,
    pow
} from 'three/tsl';
import { ParticleSystem } from './particles';

export enum VoidRootBallState {
    IDLE,
    TRACKING,
    FIRING,
    LATCHED,
    COOLDOWN
}

export interface RootBallInteraction {
    force: THREE.Vector3;
    isLatched: boolean;
    hitPoint: THREE.Vector3 | null;
}

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

const fbm = (v: any) => {
    let total = float(0.0);
    let amplitude = float(0.5);
    let frequency = float(1.0);

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

// 1. CHROMA-SHIFT ROCK (Color shifting crystalline structures)
export function createChromaShiftRock(config: { size: number }) {
    const geo = new THREE.DodecahedronGeometry(config.size, 1);

    // TSL Material for color shifting
    const mat = new MeshStandardNodeMaterial({
        roughness: 0.2,
        metalness: 0.8,
    });
    
    // Animate color based on time and position
    const uTime = time;
    const pos = positionLocal;
    
    // Iridescence logic
    const angle = sin(uTime.add(pos.x).add(pos.y));
    const col1 = color(0xff00ff); // Magenta
    const col2 = color(0x00ffff); // Cyan

    mat.colorNode = mix(col1, col2, angle.add(1.0).mul(0.5)); // mix based on sine wave

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function updateChromaRock(mesh: THREE.Mesh, cameraPos: THREE.Vector3, delta: number, timeVal: number) {
    // Slight rotation
    mesh.rotation.x += delta * 0.1;
    mesh.rotation.y += delta * 0.15;
}


// 2. FRACTURED GEODE (Safe harbors with EM fields)
export function createFracturedGeode(config: { size: number }) {
    const group = new THREE.Group();
    
    // Outer Shell (Dark rock)
    const shellGeo = new THREE.IcosahedronGeometry(config.size, 1);
    // Cut open the geode? (Simplified: just a dark rock for now with a glowing core inside sticking out)
    // Better: Boolean operation is hard. Let's make a shell of rock chunks.

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const shell = new THREE.Mesh(shellGeo, rockMat);
    group.add(shell);

    // Inner Core (Glowing Crystal)
    const coreGeo = new THREE.OctahedronGeometry(config.size * 0.6, 0);
    const coreMat = new MeshStandardNodeMaterial({
        emissive: new THREE.Color(0x8844ff),
        roughness: 0.2,
        metalness: 0.5
    });

    // Pulse effect
    const uTime = time;
    const pulse = sin(uTime.mul(2.0)).add(1.0).mul(0.5); // 0 to 1
    const baseEmit = color(0x8844ff);
    coreMat.emissiveNode = baseEmit.mul(pulse.add(0.5)); // vary intensity

    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

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

    return group;
}

export function updateGeode(group: THREE.Group, delta: number, timeVal: number) {
    // Rotate core differently than shell
    const core = group.children[1];
    if (core) {
        core.rotation.y -= delta * 0.5;
        core.rotation.z += delta * 0.2;
    }

    // Pulse field opacity
    const field = group.children[2] as THREE.Mesh;
    if (field) {
        (field.material as THREE.MeshBasicMaterial).opacity = 0.1 + Math.sin(timeVal * 2) * 0.05;
        field.rotation.y += delta * 0.1;
    }
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
        radius: config.size,
        health: 10,
        maxHealth: 10,
        isHiding: false,
        overloadValue: 0.0 // JS tracker
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

    // Dispose resources if needed (geometry/material)
    // Three.js usually handles this if we drop references, but good practice to dispose if dynamic
    // (mesh.geometry as THREE.BufferGeometry).dispose();
}


// 4. VOID ROOT BALLS (Dense tangles of roots)
export function createVoidRootBall(config: { size: number }) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 1.0 }); // Dark brown
    
    // Create many torus knots to simulate tangled roots
    const count = 5;
    for (let i = 0; i < count; i++) {
        const geo = new THREE.TorusKnotGeometry(config.size * 0.6, config.size * 0.1, 64, 8, 2, 3);
        const mesh = new THREE.Mesh(geo, material);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        group.add(mesh);
    }

    // VOID GEM CORE (Glowing eye/heart)
    const coreGeo = new THREE.IcosahedronGeometry(config.size * 0.4, 0);
    const coreMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x8800ff, // Deep purple
        emissiveIntensity: 2.0,
        roughness: 0.2
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // HARPOON TENTACLE (Initially retracted)
    // A long thin cylinder or chain of cones
    const harpoonLen = config.size * 8.0; // Long reach
    const harpoonGeo = new THREE.CylinderGeometry(0.1, 0.05, harpoonLen, 8);
    harpoonGeo.translate(0, harpoonLen / 2, 0); // Pivot at base
    harpoonGeo.rotateX(-Math.PI / 2); // Point forward Z (or lookAt direction)

    const harpoonMat = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const harpoon = new THREE.Mesh(harpoonGeo, harpoonMat);
    harpoon.scale.set(0, 0, 0); // Hidden
    harpoon.userData = { isHarpoon: true };
    group.add(harpoon);
    
    group.userData = {
        type: 'voidRootBall',
        grappleRange: config.size * 5.0, // Increased range
        state: VoidRootBallState.IDLE,
        stateTimer: 0.0,
        harpoonObject: harpoon,
        target: null
    };

    return group;
}

export function updateVoidRootBall(
    group: THREE.Group,
    delta: number,
    timeVal: number,
    player: THREE.Object3D
): RootBallInteraction {

    const result: RootBallInteraction = {
        force: new THREE.Vector3(0, 0, 0),
        isLatched: false,
        hitPoint: null
    };

    const data = group.userData;
    const playerPos = player.position;

    // Slow rotation of the ball itself
    group.rotation.x += delta * 0.1;
    group.rotation.y += delta * 0.05;

    // Harpoon Object
    const harpoon = data.harpoonObject as THREE.Mesh;

    switch (data.state) {
        case VoidRootBallState.IDLE:
            // Check for player proximity
            if (group.position.distanceTo(playerPos) < data.grappleRange) {
                data.state = VoidRootBallState.TRACKING;
                data.stateTimer = 1.0; // 1 second tracking before fire
            }
            break;

        case VoidRootBallState.TRACKING: {
            // Look at player (rotate the whole group or just the harpoon?)
            // If we rotate the group, the roots spin too. That's fine, it looks like aiming.
            // But we want a smooth turn.

            // Simple lookAt for now
            const targetLook = group.position.clone().lookAt(playerPos);
            // Slerp rotation towards player?
            // Manual:
            const targetDir = new THREE.Vector3().subVectors(playerPos, group.position).normalize();
            // We can just use lookAt on the harpoon if it wasn't child of rotating group.
            // Since harpoon is child, we might need to orient the whole ball.
            // Or detach harpoon logic.

            // Let's assume the harpoon rotates independently inside the ball?
            // No, the ball rotates to face the player.
            group.lookAt(playerPos);

            // Warning flash
            const core = group.children.find(c => (c.material as any).emissive);
            if (core) {
                const mat = (core as THREE.Mesh).material as THREE.MeshStandardMaterial;
                mat.emissive.setHex(timeVal % 0.2 < 0.1 ? 0xff0000 : 0x8800ff); // Blink red
            }

            data.stateTimer -= delta;
            if (data.stateTimer <= 0) {
                data.state = VoidRootBallState.FIRING;
                data.stateTimer = 0.5; // Extension time
                // Play sound?
            }
            break;
        }

        case VoidRootBallState.FIRING:
            // Extend harpoon
            if (harpoon) {
                const progress = 1.0 - (data.stateTimer / 0.5); // 0 to 1
                harpoon.scale.set(1, 1, progress); // Z-scale extends (geometry rotated to Z)
                harpoon.lookAt(playerPos); // Update aim during firing? Or lock it?
                // Let's update aim to be fair/scary
            }

            data.stateTimer -= delta;
            if (data.stateTimer <= 0) {
                // Check hit
                // Simple distance check (since we aimed)
                // Or raycast?
                // If aiming was perfect, we hit.
                // Give player a chance to dodge?
                // If distance < maxReach and angle is close?
                // Since we aim every frame in FIRING, we hit unless player moved VERY fast in last frame.

                const dist = group.position.distanceTo(playerPos);
                if (dist < data.grappleRange * 1.2) { // Slightly more than trigger range
                     data.state = VoidRootBallState.LATCHED;
                     data.stateTimer = 3.0; // Hold for 3 seconds
                } else {
                     data.state = VoidRootBallState.COOLDOWN;
                     data.stateTimer = 2.0;
                }
            }
            break;

        case VoidRootBallState.LATCHED:
            result.isLatched = true;
            result.hitPoint = playerPos.clone();

            // Spring Physics
            const direction = new THREE.Vector3().subVectors(group.position, playerPos).normalize();
            // Pull strength
            const pull = 15.0; // Strong pull
            result.force.copy(direction.multiplyScalar(pull * delta));

            // Visuals: Harpoon stuck to player
            if (harpoon) {
                harpoon.lookAt(playerPos);
                const currentDist = group.position.distanceTo(playerPos);
                // Harpoon length is size * 8.
                // Scale Z to match distance
                // Geo has length `harpoonLen`. scale.z = currentDist / harpoonLen
                // Assuming harpoonLen was saved or calculated.
                // In create: harpoonLen = config.size * 8.0
                const baseLen = (group.userData.grappleRange / 5.0) * 8.0; // Reverse engineer or store it.
                // Better: store in userData
                const realLen = group.userData.grappleRange * 1.6; // approx 5.0 * 8/5 ?? No.
                // config.size * 8.0 vs config.size * 5.0 (range). So length is > range.
                // scale 1 means length = size * 8.
                // scale Z = dist / (size * 8).
                const maxLen = group.userData.grappleRange * (8.0/5.0);
                harpoon.scale.set(1, 1, currentDist / maxLen);
            }

            data.stateTimer -= delta;
            if (data.stateTimer <= 0) {
                data.state = VoidRootBallState.COOLDOWN;
                data.stateTimer = 2.0;
            }
            break;

        case VoidRootBallState.COOLDOWN: {
            // Retract
            if (harpoon) {
                harpoon.scale.z *= 0.9;
                if (harpoon.scale.z < 0.01) harpoon.scale.set(0,0,0);
            }

            // Restore core color
            const core = group.children.find(c => (c.material as any).emissive);
            if (core) {
                ((core as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0x8800ff);
            }

            data.stateTimer -= delta;
            if (data.stateTimer <= 0) {
                data.state = VoidRootBallState.IDLE;
            }
            break;
        }
    }

    return result;
}


// 5. VACUUM KELP (Swaying energy-draining stalks)
export function createVacuumKelp(config: { length: number, nodes: number }) {
    // Chain of objects or a skinned mesh.
    // Simplified: A series of capsules.
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        emissive: 0x002288,
        emissiveIntensity: 0.5,
        roughness: 0.4
    });

    const nodeHeight = config.length / config.nodes;
    const geo = new THREE.CapsuleGeometry(0.5, nodeHeight - 0.5, 4, 8);

    for (let i = 0; i < config.nodes; i++) {
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.y = i * nodeHeight;
        // Store initial rotation for animation
        mesh.userData.idx = i;
        mesh.userData.baseY = mesh.position.y;
        group.add(mesh);
    }

    group.userData = {
        type: 'vacuumKelp',
        nodes: config.nodes
    };

    return group;
}

export function updateVacuumKelp(group: THREE.Group, delta: number, timeVal: number) {
    // Sway animation
    const swaySpeed = 2.0;
    const swayAmp = 0.2;
    
    group.children.forEach((child, i) => {
        // Each node sways with phase offset
        const angle = Math.sin(timeVal * swaySpeed + i * 0.5) * swayAmp * (i + 1) * 0.1; // More sway at top
        child.position.x = Math.sin(angle) * (i * 2); // Simple displacement
        child.rotation.z = angle;
    });
}


// 6. ICE NEEDLE CLUSTERS (Shatter on impact)
export function createIceNeedleCluster(config: { count: number }) {
    const group = new THREE.Group();
    const material = new THREE.MeshPhysicalMaterial({
        color: 0xaaddff,
        transmission: 0.8,
        opacity: 0.9,
        metalness: 0.1,
        roughness: 0.0,
        ior: 1.31 // Ice
    });

    const geo = new THREE.ConeGeometry(0.2, 4, 6);

    for (let i = 0; i < config.count; i++) {
        const mesh = new THREE.Mesh(geo, material);
        // Radiate outwards
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        
        mesh.position.set(0, 0, 0); // Center
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        
        // Offset slightly from center
        mesh.translateY(1.5);
        
        group.add(mesh);
    }
    
    return group;
}

export function updateIceNeedleCluster(group: THREE.Group, delta: number, timeVal: number) {
    // Slowly rotate
    group.rotation.y += delta * 0.05;
    group.rotation.z += delta * 0.02;
}


// 7. LIQUID METAL BLOBS (Splitting/Recombining)
export function createLiquidMetalBlob(config: { size: number }) {
    // Metaballs are hard in standard Three.js without marching cubes.
    // Approximation: A group of spheres that move near each other.
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        metalness: 1.0,
        roughness: 0.0,
        envMapIntensity: 1.0
    });
    
    const mainGeo = new THREE.SphereGeometry(config.size, 32, 32);
    const main = new THREE.Mesh(mainGeo, material);
    group.add(main);

    // Satellites
    const count = 3;
    for (let i = 0; i < count; i++) {
        const s = config.size * (0.3 + Math.random() * 0.4);
        const sat = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 16), material);
        sat.userData = {
            orbitSpeed: 1 + Math.random(),
            orbitRadius: config.size * 1.5,
            phase: Math.random() * Math.PI * 2,
            axis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize()
        };
        group.add(sat);
    }

    return group;
}

export function updateLiquidMetalBlob(group: THREE.Group, delta: number, timeVal: number) {
    // Animate satellites orbiting smoothly
    for (let i = 1; i < group.children.length; i++) {
        const sat = group.children[i];
        const d = sat.userData;
        const angle = timeVal * d.orbitSpeed + d.phase;
        
        // Circular orbit logic (simplified)
        // Rotate a vector
        const pos = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).multiplyScalar(d.orbitRadius);
        pos.applyAxisAngle(d.axis, angle * 0.1); // Precession

        sat.position.copy(pos);

        // "Goopy" scaling when moving fast?
        // kept simple for now
    }
}


// 8. MAGMA HEARTS (Pulsing, erupting)
export function createMagmaHeart(config: { size: number }) {
    const geo = new THREE.SphereGeometry(config.size, 32, 32);
    const mat = new MeshStandardNodeMaterial({
        color: 0x220000,
        roughness: 0.9,
    });
    
    // Lava cracks (Emissive)
    const uTime = time;
    const pos = positionLocal;
    
    // Noise-based cracks
    const noise = sin(pos.x.mul(5.0).add(uTime)).mul(sin(pos.y.mul(5.0))).add(sin(pos.z.mul(5.0)));
    const crack = noise.greaterThan(0.5); // Threshold
    
    const lavaColor = color(0xff3300);
    const rockColor = color(0x000000); // No emission
    
    mat.emissiveNode = mix(rockColor, lavaColor, noise.max(0.0).mul(2.0)); // Glow based on noise
    
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
}

export function updateMagmaHeart(mesh: THREE.Mesh, delta: number, timeVal: number) {
    // Pulse scale for heartbeat
    const beat = Math.sin(timeVal * 5.0); // Fast beat
    // Sharp beat:
    const scale = 1.0 + Math.pow(Math.max(0, beat), 4.0) * 0.1;
    mesh.scale.setScalar(scale);

    mesh.rotation.y += delta * 0.1;
}


// --- GPU SPORE CLOUD ---
export class SporeCloud {
    scene: THREE.Scene;
    spores: THREE.InstancedMesh;
    active: boolean = true;
    position: THREE.Vector3; // Center of cloud

    constructor(scene: THREE.Scene, position: THREE.Vector3, count: number) {
        this.scene = scene;
        this.position = position;

        // TSL-based material
        const material = new MeshBasicNodeMaterial({
            color: 0x88ff88,
            transparent: true,
            opacity: 0.8
        });

        const uTime = time;
        const uShockPos = uniform(new THREE.Vector3(0, 0, 0));
        const uShockStrength = uniform(0.0);

        // --- Vertex Animation ---
        // 1. Brownian Motion
        const idx = float(instanceIndex);
        const t = uTime.mul(0.5);

        // Pseudo-random offsets based on index and time
        const noiseX = sin(t.add(idx).mul(1.1)).add(cos(t.mul(0.7).add(idx.mul(2.0))));
        const noiseY = cos(t.add(idx.mul(1.5)).mul(1.2)).add(sin(t.mul(0.8).add(idx)));
        const noiseZ = sin(t.add(idx.mul(0.5)).mul(1.3)).add(cos(t.mul(0.9).add(idx.mul(3.0))));

        let motion = vec3(noiseX, noiseY, noiseZ).mul(0.05); // Small amplitude

        // 2. Shockwave Interaction
        // Use positionLocal (instance center approx) + motion to get animated position
        // We use positionLocal as a proxy for world position relative to cloud center if we assume cloud is at 0,0,0
        // But spores are placed at absolute world positions via instance matrix.
        // In TSL, `positionLocal` is the geometry vertex.
        // To get the world position of the instance, we need to rely on the fact that for spheres,
        // center is 0,0,0 in local space.
        // But the shader runs on vertices.
        // Let's use `modelWorldMatrix * vec4(0,0,0,1)` to get instance center?
        // TSL: `(modelWorldMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz`

        // Simplified: The shockwave affects the vertex based on its distance to shock center.
        // We need to transform uShockPos to local space?
        // Or just assume `positionLocal` + instance translation is what we care about.
        // Wait, TSL handles InstancedMesh automatically.
        // We will just use `distance(positionLocal, ...)` but `uShockPos` is World.

        // Let's try to pass `uShockPos` in Local Space of the cloud.
        // The cloud `spores` mesh is at (0,0,0) world usually if added to scene?
        // In constructor: `this.scene.add(this.spores);`
        // So mesh local space == world space (if scene is root).
        // Instances have their own transform.

        // IMPORTANT: In `MeshBasicNodeMaterial` for `InstancedMesh`:
        // `positionLocal` is the vertex position in the geometry (e.g. on the sphere surface).
        // The final position is `instanceMatrix * positionLocal`.

        // To interact properly, we need the World Position of the vertex.
        // We can get `positionWorld` (varying) but that's for fragment shader?
        // In vertex stage, we can construct it if needed.
        // However, a simple visual hack:
        // Use `distance(vec3(0.0), positionLocal)` -> always small (radius of spore).

        // Let's just implement a global "pulse" when hit, affecting all spores,
        // because calculating per-instance distance to a point without attributes is hard in pure TSL currently.
        // We will displace all particles outwards from their center based on noise to simulate agitation.

        const agitation = uShockStrength.mul(vec3(noiseX, noiseY, noiseZ).mul(2.0));
        motion = motion.add(agitation);

        // Apply motion to position
        material.positionNode = positionLocal.add(motion);

        // Store uniforms for JS access
        material.userData = {
            uShockPos,
            uShockStrength
        };

        // Create geometry
        const geometry = new THREE.SphereGeometry(0.1, 4, 4);

        this.spores = new THREE.InstancedMesh(geometry, material, count);
        this.spores.instanceMatrix.setUsage(THREE.StaticDrawUsage); // Static!
        this.spores.userData = { parentCloud: this };
        this.scene.add(this.spores);

        const dummy = new THREE.Object3D();

        // Initialize spores in a cloud shape
        for (let i = 0; i < count; i++) {
            // Random position within cloud radius
            const r = 5 * Math.cbrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const x = position.x + r * Math.sin(phi) * Math.cos(theta);
            const y = position.y + r * Math.sin(phi) * Math.sin(theta);
            const z = position.z + r * Math.cos(phi);

            dummy.position.set(x, y, z);
            dummy.updateMatrix();
            this.spores.setMatrixAt(i, dummy.matrix);
        }

        this.spores.instanceMatrix.needsUpdate = true;
    }

    update(delta: number) {
        // Decay shockwave strength
        const mat = this.spores.material as any;
        if (mat.userData && mat.userData.uShockStrength) {
            const current = mat.userData.uShockStrength.value;
            if (current > 0.01) {
                mat.userData.uShockStrength.value = current * 0.9; // Decay
            } else {
                mat.userData.uShockStrength.value = 0;
            }
        }
    }

    triggerChainReaction(hitPoint: THREE.Vector3) {
        const mat = this.spores.material as any;
        if (mat.userData && mat.userData.uShockStrength) {
            mat.userData.uShockStrength.value = 1.0; // Trigger agitation
            // Optionally update position if we were doing distance checks
            if (mat.userData.uShockPos) {
                mat.userData.uShockPos.value.copy(hitPoint);
            }
        }
        return 5;
    }
}
