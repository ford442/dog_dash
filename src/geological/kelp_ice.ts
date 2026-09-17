import * as THREE from 'three';

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
        // Radiate outwards from the cluster origin (cone tip is +Y).
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        const dir = new THREE.Vector3(
            Math.sin(theta) * Math.cos(phi),
            Math.cos(theta),
            Math.sin(theta) * Math.sin(phi)
        );
        mesh.position.copy(dir).multiplyScalar(1.5);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        
        group.add(mesh);
    }
    
    return group;
}

export function updateIceNeedleCluster(group: THREE.Group, delta: number, timeVal: number) {
    // Slowly rotate
    group.rotation.y += delta * 0.05;
    group.rotation.z += delta * 0.02;
}
