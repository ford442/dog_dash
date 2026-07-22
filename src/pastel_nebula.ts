import * as THREE from 'three';
import { time, color, uniform, sin, mix, positionWorld, float, uv, length, smoothstep } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

function shouldUseLiteMaterials(): boolean {
    return typeof window !== 'undefined' && window.usingWebGL === true;
}

function createLitePastelMaterial(colorHex: number, opacity: number, uPlayerPos: any): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: opacity * 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
    });
    mat.userData.uPlayerPos = uPlayerPos;
    return mat;
}

// Utility for creating materials inside the system
function createPastelNebulaMaterial(
    color1: number,
    color2: number,
    opacity: number,
    uPlayerPos: any
) {
    if (shouldUseLiteMaterials()) {
        return createLitePastelMaterial(color1, opacity, uPlayerPos);
    }

    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
    });

    const vUv = uv();

    // Distance from center for soft puff
    const dist = length(vUv.sub(0.5));
    const circleAlpha = smoothstep(0.5, 0.2, dist);

    // Some simple animated swirly noise
    const baseColor = mix(color(color1), color(color2), sin(time.mul(0.5).add(vUv.x.mul(3.0))).mul(0.5).add(0.5));

    // Dynamic player glow
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlow = smoothstep(40.0, 10.0, distToPlayer);

    const finalColor = baseColor.toVar();
    finalColor.addAssign(color(0xffffff).mul(playerGlow).mul(0.5));

    mat.colorNode = finalColor;
    mat.opacityNode = circleAlpha.mul(opacity).mul(0.8);

    return mat;
}

function createGlitterMaterial(
    uPlayerPos: any
) {
    if (shouldUseLiteMaterials()) {
        return createLitePastelMaterial(0xffffff, 0.6, uPlayerPos);
    }

    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
    });

    const vUv = uv();
    const dist = length(vUv.sub(0.5));
    const starAlpha = smoothstep(0.2, 0.05, dist); // Sharp center

    const twinkle = sin(time.mul(3.0).add(positionWorld.x.mul(10.0))).mul(0.5).add(0.5);

    // Distant light interaction
    const distToPlayer = length(positionWorld.sub(uPlayerPos));
    const playerGlow = smoothstep(30.0, 5.0, distToPlayer);

    const finalColor = color(0xffffff).mul(twinkle.add(0.2)).toVar();
    finalColor.addAssign(color(0xffaaff).mul(playerGlow));

    mat.colorNode = finalColor;
    mat.opacityNode = starAlpha.mul(twinkle.add(0.2));

    return mat;
}

class PastelNebulaLayer {
    mesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    count: number;
    width: number;
    positions: Float32Array;

    constructor(
        scene: THREE.Scene,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        config: {
            count: number,
            z: number,
            zRange: number,
            width: number,
            yRange: number,
            scaleMin: number,
            scaleMax: number
        }
    ) {
        this.count = config.count;
        this.width = config.width;
        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.frustumCulled = false;

        this.dummy = new THREE.Object3D();
        this.positions = new Float32Array(this.count * 3);

        for(let i=0; i<this.count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * config.yRange;
            const z = config.z + (Math.random() - 0.5) * config.zRange;

            this.positions[i*3] = x;
            this.positions[i*3+1] = y;
            this.positions[i*3+2] = z;

            this.dummy.position.set(x, y, z);
            const s = config.scaleMin + Math.random() * (config.scaleMax - config.scaleMin);
            this.dummy.scale.setScalar(s);
            this.dummy.rotation.z = Math.random() * Math.PI * 2;

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        scene.add(this.mesh);
        this.mesh.visible = false;
    }

    update(cameraX: number) {
        const margin = 50;
        const limitBack = cameraX - (this.width / 2) - margin;
        const limitFront = cameraX + (this.width / 2) + margin;
        let instanceMatrixNeedsUpdate = false;

        for(let i=0; i<this.count; i++) {
            const idx = i*3;
            let x = this.positions[idx];
            let needsUpdate = false;

            if (x < limitBack) {
                x += this.width + margin * 2;
                this.positions[idx] = x;
                needsUpdate = true;
                instanceMatrixNeedsUpdate = true;
            } else if (x > limitFront) {
                x -= (this.width + margin * 2);
                this.positions[idx] = x;
                needsUpdate = true;
                instanceMatrixNeedsUpdate = true;
            }

            if (needsUpdate) {
                this.mesh.getMatrixAt(i, this.dummy.matrix);
                const p = new THREE.Vector3();
                const q = new THREE.Quaternion();
                const s = new THREE.Vector3();
                this.dummy.matrix.decompose(p, q, s);

                this.dummy.position.set(x, this.positions[idx+1], this.positions[idx+2]);
                this.dummy.scale.copy(s);
                this.dummy.quaternion.copy(q);

                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(i, this.dummy.matrix);
            }
        }

        if (instanceMatrixNeedsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

export class PastelNebulaSystem {
    scene: THREE.Scene;
    active: boolean = false;
    layers: PastelNebulaLayer[] = [];
    uPlayerPos: any;

    constructor(scene: THREE.Scene, weaponLightManager: any) {
        this.scene = scene;
        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));

        // Setup layers
        const puffGeo = new THREE.PlaneGeometry(1, 1);

        // Deep background puffy pinks/purples
        this.layers.push(new PastelNebulaLayer(this.scene, puffGeo, createPastelNebulaMaterial(0xffb6c1, 0xdda0dd, 0.4, this.uPlayerPos), {
            count: 25, z: -60, zRange: 15, width: 300, yRange: 80, scaleMin: 20, scaleMax: 45
        }));

        // Midground cyan/teals
        this.layers.push(new PastelNebulaLayer(this.scene, puffGeo, createPastelNebulaMaterial(0xe0ffff, 0x87cefa, 0.3, this.uPlayerPos), {
            count: 20, z: -40, zRange: 10, width: 250, yRange: 60, scaleMin: 15, scaleMax: 35
        }));

        // Floating glitter particles
        this.layers.push(new PastelNebulaLayer(this.scene, puffGeo, createGlitterMaterial(this.uPlayerPos), {
            count: 80, z: -20, zRange: 20, width: 200, yRange: 50, scaleMin: 0.5, scaleMax: 1.5
        }));

        this.deactivate();
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.layers.forEach(l => l.mesh.visible = true);
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.layers.forEach(l => l.mesh.visible = false);
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (playerPos) this.uPlayerPos.value.copy(playerPos);
        if (!this.active) return;

        this.layers.forEach(l => l.update(cameraX));
    }
}
