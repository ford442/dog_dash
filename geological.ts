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
    smoothstep
} from 'three/tsl';

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
    const geo = new THREE.SphereGeometry(config.size, 48, 48);
    
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
    
    // Vertex Wobble Logic (TSL)
    const uTime = time;
    const pos = positionLocal;
    const norm = normalLocal;

    // Organic noise-like movement using combined sine waves
    const freq = float(1.5);
    const speed = float(2.0);
    const amp = float(config.size * 0.15); // 15% surface wobble

    const wobbleX = sin(pos.y.mul(freq).add(uTime.mul(speed)));
    const wobbleY = sin(pos.z.mul(freq).add(uTime.mul(speed.mul(1.1))));
    const wobbleZ = sin(pos.x.mul(freq).add(uTime.mul(speed.mul(0.9))));
    const wobble = wobbleX.add(wobbleY).add(wobbleZ);

    // Displace vertices along normal
    const newPos = pos.add(norm.mul(wobble.mul(amp)));
    mat.positionNode = newPos;

    // Pulsing Emissive Rim
    const pulse = sin(uTime.mul(3.0)).add(1.0).mul(0.5);
    mat.emissiveNode = color(0x00ff88).mul(pulse.mul(0.5));

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
        isHiding: false
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
    
    group.userData = {
        type: 'voidRootBall',
        grappleRange: config.size * 3.0
    };

    return group;
}

export function updateVoidRootBall(group: THREE.Group, delta: number, timeVal: number, playerPos: THREE.Vector3) {
    // Slow rotation
    group.rotation.x += delta * 0.1;
    group.rotation.y += delta * 0.05;

    // Grapple Logic (Visual only for now)
    // If player is close, maybe extend a "root" towards them?
    const dist = group.position.distanceTo(playerPos);
    if (dist < group.userData.grappleRange) {
        // Look at player?
        // group.lookAt(playerPos); // Might be too abrupt
    }
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
