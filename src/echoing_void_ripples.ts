import * as THREE from 'three';
import { time, vec2, vec3, color, positionLocal, uv, distance, sin, smoothstep, float, mix, varying } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { decorationBudget } from './decoration_budget';


const MAX_RIPPLES = 15;
const dummy = new THREE.Object3D();
const dummyMat = new THREE.Matrix4();

export class EchoingVoidRipplesSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 0;

    private rippleData: {
        x: number;
        y: number;
        z: number;
        scale: number;
        startTime: number;
        duration: number;
        active: boolean;
    }[];

    private color1 = new THREE.Color(0x00ffff);
    private color2 = new THREE.Color(0xff00ff);
    private speedMultiplier = 1.0;

    private nextSpawnTime = 0;
    private currentTime = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.FrontSide
        });

        // TSL Shader
        const vUv = varying(uv());
        const center = vec2(0.5, 0.5);
        const dist = distance(vUv, center);

        // Expanding ring effect
        // We use distance from center and time
        const ring = sin(dist.mul(100.0).sub(time.mul(5.0)));
        // Soft edge
        const edgeFade = smoothstep(0.5, 0.4, dist);
        // Center fade
        const centerFade = smoothstep(0.0, 0.1, dist);

        const finalAlpha = ring.mul(edgeFade).mul(centerFade).max(0.0);

        mat.colorNode = color(this.color1);
        mat.opacityNode = finalAlpha;

        this.mesh = new THREE.InstancedMesh(geo, mat, MAX_RIPPLES);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -5; // deep background

        this.rippleData = Array.from({ length: MAX_RIPPLES }, () => ({
            x: 0,
            y: 0,
            z: 0,
            scale: 1,
            startTime: 0,
            duration: 0,
            active: false
        }));

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate(config?: { density?: number, speed?: number, color1?: number, color2?: number }) {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;

        const density = config?.density ?? 1.0;
        this.speedMultiplier = config?.speed ?? 1.0;

        if (config?.color1 !== undefined) this.color1.setHex(config.color1);
        if (config?.color2 !== undefined) this.color2.setHex(config.color2);

        const targetCount = Math.floor(MAX_RIPPLES * Math.min(1.0, density));
        this.count = targetCount;
decorationBudget.syncCount('echoing_void_ripples', this.count);
        this.mesh.count = this.count;

        this.currentTime = 0;
        this.nextSpawnTime = 0;

        // Reset all ripples
        for (let i = 0; i < MAX_RIPPLES; i++) {
            this.rippleData[i].active = false;
            dummyMat.identity();
            dummyMat.decompose(dummy.position, dummy.quaternion, dummy.scale);
            dummy.scale.set(0,0,0);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
        this.count = 0;
decorationBudget.syncCount('echoing_void_ripples', 0);
    }

    update(delta: number, cameraX: number, speed: number = 8) {
        if (!this.active) return;

        this.currentTime += delta * this.speedMultiplier;

        // Spawn new ripples
        if (this.currentTime > this.nextSpawnTime) {
            // Find an inactive ripple
            let spawned = false;
            for (let i = 0; i < this.count; i++) {
                if (!this.rippleData[i].active) {
                    const r = this.rippleData[i];
                    r.active = true;
                    // Spawn far ahead of camera or scattered
                    r.x = cameraX + (Math.random() * 4000 - 1000);
                    r.y = Math.random() * 1000 - 500;
                    r.z = -1000 - Math.random() * 500;
                    r.scale = 100 + Math.random() * 400;
                    r.startTime = this.currentTime;
                    r.duration = 10 + Math.random() * 20; // 10 to 30 seconds
                    spawned = true;
                    break;
                }
            }
            if (spawned) {
                this.nextSpawnTime = this.currentTime + (2.0 + Math.random() * 3.0) / this.speedMultiplier;
            } else {
                this.nextSpawnTime = this.currentTime + 1.0;
            }
        }

        let needsUpdate = false;
        for (let i = 0; i < this.count; i++) {
            const r = this.rippleData[i];
            if (r.active) {
                const age = this.currentTime - r.startTime;
                if (age > r.duration) {
                    r.active = false;
                    dummyMat.identity();
                    dummyMat.decompose(dummy.position, dummy.quaternion, dummy.scale);
                    dummy.scale.set(0, 0, 0);
                    dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, dummy.matrix);
                    needsUpdate = true;
                } else {
                    const progress = age / r.duration;
                    const currentScale = r.scale * progress;

                    dummyMat.identity();
                    dummyMat.makeTranslation(r.x, r.y, r.z);
                    dummyMat.decompose(dummy.position, dummy.quaternion, dummy.scale);
                    dummy.scale.set(currentScale, currentScale, 1);
                    dummy.updateMatrix();
                    this.mesh.setMatrixAt(i, dummy.matrix);
                    needsUpdate = true;
                }
            }
        }

        if (needsUpdate) {
            this.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as any).dispose?.();
        }
        this.count = 0;
decorationBudget.syncCount('echoing_void_ripples', 0);
    }
}
