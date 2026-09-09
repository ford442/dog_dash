import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { time, positionLocal, color, sin, mix } from 'three/tsl';

/** Magma hearts (pulsing, erupting) — kept separate from liquid-metal system for code-splitting. */
export function createMagmaHeart(config: { size: number }) {
    const geo = new THREE.SphereGeometry(config.size, 32, 32);
    const mat = new MeshStandardNodeMaterial({
        color: 0x220000,
        roughness: 0.9,
    });

    const uTime = time;
    const pos = positionLocal;

    const noise = sin(pos.x.mul(5.0).add(uTime)).mul(sin(pos.y.mul(5.0))).add(sin(pos.z.mul(5.0)));
    void noise.greaterThan(0.5);

    const lavaColor = color(0xff3300);
    const rockColor = color(0x000000);

    mat.emissiveNode = mix(rockColor, lavaColor, noise.max(0.0).mul(2.0));

    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
}

export function updateMagmaHeart(mesh: THREE.Mesh, delta: number, timeVal: number) {
    const beat = Math.sin(timeVal * 5.0);
    const scale = 1.0 + Math.pow(Math.max(0, beat), 4.0) * 0.1;
    mesh.scale.setScalar(scale);
    mesh.rotation.y += delta * 0.1;
}
