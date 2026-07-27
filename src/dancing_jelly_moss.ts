import * as THREE from 'three';
import {
    time, vec3, color, uniform, sin,
    positionLocal, positionWorld, distance, mix, smoothstep, float
} from 'three/tsl';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { ParticleSystem } from './particles';

export class DancingJellyMossSystem {
    scene: THREE.Scene;
    active: boolean = false;

    // Config
    private mossCount: number = 200;
    private width: number = 800;
    private height: number = 40;
    private depth: number = 20;

    private mossGroup: THREE.Group;
    private mossMesh!: THREE.InstancedMesh;
    private fairyLightsMesh!: THREE.InstancedMesh;

    private uPlayerPos = uniform(vec3(0, 0, 0));
    private lastPlayerPos = new THREE.Vector3();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.mossGroup = new THREE.Group();
        this.scene.add(this.mossGroup);

        this.initMoss();
        this.initFairyLights();

        this.deactivate();
    }

    private initMoss() {
        const geo = new THREE.DodecahedronGeometry(1.5, 2);

        // TSL material for jelly moss
        const mat = new MeshStandardNodeMaterial({
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            roughness: 0.2,
            metalness: 0.1
        });

        const baseColor = color(0x22cc77);
        const glowColor = color(0x88ffaa);

        // Organic swaying based on time and local y position
        const swayY = sin(time.mul(2.0).add(positionWorld.x.mul(0.1))).mul(positionLocal.y.mul(0.2));
        const swayX = sin(time.mul(1.5).add(positionWorld.z.mul(0.1))).mul(positionLocal.y.mul(0.1));

        mat.positionNode = positionLocal.add(vec3(swayX, swayY, 0));

        // Glow effect when player is near
        const distToPlayer = distance(positionWorld, this.uPlayerPos);
        const proximityGlow = smoothstep(20.0, 5.0, distToPlayer);

        mat.colorNode = mix(baseColor, glowColor, proximityGlow);
        mat.emissiveNode = glowColor.mul(proximityGlow.mul(0.5));

        this.mossMesh = new THREE.InstancedMesh(geo, mat, this.mossCount);
        this.mossMesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.mossCount; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                -10 - Math.random() * this.depth
            );

            const s = 0.5 + Math.random() * 1.5;
            dummy.scale.set(s, s * (0.8 + Math.random() * 0.4), s);

            dummy.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            dummy.updateMatrix();
            this.mossMesh.setMatrixAt(i, dummy.matrix);
        }

        this.mossGroup.add(this.mossMesh);
    }

    private initFairyLights() {
        const geo = new THREE.PlaneGeometry(0.5, 0.5);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });

        const lightColor = color(0xaaffcc);

        // Gentle bobbing and pulsing
        const bobOffset = sin(time.mul(3.0).add(positionWorld.x)).mul(0.5);
        mat.positionNode = positionLocal.add(vec3(0, bobOffset, 0));

        const pulse = sin(time.mul(4.0).add(positionWorld.z)).mul(0.5).add(0.5);
        mat.colorNode = lightColor;
        mat.opacityNode = mix(float(0.2), float(0.9), pulse);

        this.fairyLightsMesh = new THREE.InstancedMesh(geo, mat, this.mossCount * 3);
        this.fairyLightsMesh.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.mossCount * 3; i++) {
            dummy.position.set(
                (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * this.height,
                -5 - Math.random() * this.depth
            );

            dummy.updateMatrix();
            this.fairyLightsMesh.setMatrixAt(i, dummy.matrix);
        }

        this.mossGroup.add(this.fairyLightsMesh);
    }

    activate(config?: { density?: number }) {
        if (this.active) return;
        this.active = true;
        this.mossGroup.visible = true;

        if (config && config.density !== undefined) {
            this.mossMesh.count = Math.floor(this.mossCount * config.density);
            this.fairyLightsMesh.count = Math.floor(this.mossCount * 3 * config.density);
        } else {
            this.mossMesh.count = this.mossCount;
            this.fairyLightsMesh.count = this.mossCount * 3;
        }
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mossGroup.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
            this.lastPlayerPos.copy(playerPos);
        }

        // Wrap instances to create an infinite parallax field
        const wrapDist = this.width;
        const halfWrap = wrapDist / 2;
        const dummy = new THREE.Object3D();

        for (let i = 0; i < this.mossMesh.count; i++) {
            this.mossMesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

            let moved = false;
            if (dummy.position.x < cameraX - halfWrap) {
                dummy.position.x += wrapDist;
                moved = true;
            } else if (dummy.position.x > cameraX + halfWrap) {
                dummy.position.x -= wrapDist;
                moved = true;
            }

            if (moved) {
                dummy.updateMatrix();
                this.mossMesh.setMatrixAt(i, dummy.matrix);
                this.mossMesh.instanceMatrix.needsUpdate = true;
            }
        }

        for (let i = 0; i < this.fairyLightsMesh.count; i++) {
            this.fairyLightsMesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

            let moved = false;
            if (dummy.position.x < cameraX - halfWrap) {
                dummy.position.x += wrapDist;
                moved = true;
            } else if (dummy.position.x > cameraX + halfWrap) {
                dummy.position.x -= wrapDist;
                moved = true;
            }

            // Make fairy lights slowly drift left/right
            dummy.position.x -= delta * (1.0 + Math.sin(i) * 0.5);
            dummy.updateMatrix();
            this.fairyLightsMesh.setMatrixAt(i, dummy.matrix);
            this.fairyLightsMesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        this.scene.remove(this.mossGroup);
        this.mossMesh.geometry.dispose();
        (this.mossMesh.material as THREE.Material).dispose();
        this.fairyLightsMesh.geometry.dispose();
        (this.fairyLightsMesh.material as THREE.Material).dispose();
    }
}
