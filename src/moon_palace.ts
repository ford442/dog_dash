import * as THREE from 'three';
import { time, color, uniform, sin, mix, positionWorld, length, smoothstep, uv, max } from 'three/tsl';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';

export class MoonPalaceSystem {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    weaponLightManager: any;

    active: boolean = false;
    levelDistance: number = 2000;
    private group: THREE.Group;
    private uPlayerPos: any;
    private uTime: any;
    private palaceMesh: THREE.Mesh;
    private laddersMesh: THREE.InstancedMesh;
    private windowsMesh: THREE.InstancedMesh;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, weaponLightManager: any) {
        this.scene = scene;
        this.camera = camera;
        this.weaponLightManager = weaponLightManager;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        // Background far position
        this.group.position.set(0, 0, -200);

        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));
        this.uTime = uniform(0);

        this.palaceMesh = this.createPalace();
        this.group.add(this.palaceMesh);

        this.laddersMesh = this.createLadders();
        this.group.add(this.laddersMesh);

        this.windowsMesh = this.createWindows();
        this.group.add(this.windowsMesh);

        this.deactivate();
    }

    private createPalace(): THREE.Mesh {
        const geo = new THREE.SphereGeometry(60, 64, 64);

        const mat = new MeshStandardNodeMaterial({
            transparent: true,
            opacity: 0.95,
            roughness: 0.1,
            metalness: 0.8
        });

        // Glowing crystal with heart craters shader logic
        const vUv = uv();
        const baseColor = color(0xddf8ff);

        // Simulating craters with some noise/uv magic or just a glowing pulse
        const pulse = sin(time.mul(2.0)).mul(0.1).add(0.9);
        const glow = color(0xaaccff).mul(pulse);

        // Player light interaction
        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const playerLight = smoothstep(150.0, 50.0, distToPlayer);

        const finalColor = baseColor.toVar();
        finalColor.addAssign(glow);
        finalColor.addAssign(color(0xffffff).mul(playerLight).mul(0.5));

        mat.colorNode = finalColor;
        mat.emissiveNode = color(0x88ccff).mul(0.2);

        const mesh = new THREE.Mesh(geo, mat);
        return mesh;
    }

    private createLadders(): THREE.InstancedMesh {
        const geo = new THREE.CylinderGeometry(1, 1, 80, 8);
        const mat = new MeshStandardNodeMaterial({
            color: 0xc0c0c0,
            metalness: 1.0,
            roughness: 0.2,
            transparent: true,
            opacity: 0.8
        });

        const mesh = new THREE.InstancedMesh(geo, mat, 5);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const r = 62;
            dummy.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
            dummy.rotation.x = Math.PI / 4;
            dummy.rotation.z = angle;
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        return mesh;
    }

    private createWindows(): THREE.InstancedMesh {
        const geo = new THREE.PlaneGeometry(5, 5);
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const pulse = sin(time.mul(3.0)).mul(0.5).add(0.5);
        mat.colorNode = color(0xffeb3b).mul(pulse.add(0.5));

        const count = 12;
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const y = (Math.random() - 0.5) * 40;
            const r = 60.5;
            dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
            // Face outward
            dummy.lookAt(dummy.position.clone().multiplyScalar(2));
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }

        return mesh;
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.group.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.group.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        // Approach scaling (parallax)
        const progress = Math.max(0, Math.min(1, cameraX / this.levelDistance));

        // Start far and small, get closer and larger
        const scale = 0.5 + progress * 1.5;
        this.group.scale.setScalar(scale);

        // Move it from deep background to mid background
        const startZ = -400;
        const endZ = -100;
        this.group.position.z = startZ + (endZ - startZ) * progress;

        // Slight rotation to show it's alive
        this.group.rotation.y += 0.05 * delta;
        this.palaceMesh.rotation.x += 0.02 * delta;
    }

    cleanup() {
        this.scene.remove(this.group);
        this.palaceMesh.geometry.dispose();
        (this.palaceMesh.material as THREE.Material).dispose();

        this.laddersMesh.geometry.dispose();
        (this.laddersMesh.material as THREE.Material).dispose();

        this.windowsMesh.geometry.dispose();
        (this.windowsMesh.material as THREE.Material).dispose();
    }
}
