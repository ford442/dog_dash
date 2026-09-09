import * as THREE from 'three';
import { time, color, uniform, sin, mix, dot, fract, vec2, float, vec4, positionWorld, length, smoothstep, uv, max } from 'three/tsl';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';

const random2D = (v: any) => {
    return sin(dot(v, vec2(12.9898, 78.233))).mul(43758.5453).fract();
};

const valueNoise = (v: any) => {
    const i = v.floor();
    const f = v.fract();
    const a = random2D(i);
    const b = random2D(i.add(vec2(1.0, 0.0)));
    const c = random2D(i.add(vec2(0.0, 1.0)));
    const d = random2D(i.add(vec2(1.0, 1.0)));
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    return mix(a, b, u.x).add(
        (c.sub(a).mul(u.y).mul(float(1.0).sub(u.x))).add(
        (d.sub(b).mul(u.x).mul(u.y)))
    );
};

const fbm = (v: any) => {
    const o1 = valueNoise(v).mul(0.5);
    const o2 = valueNoise(v.mul(2.0)).mul(0.25);
    const o3 = valueNoise(v.mul(4.0)).mul(0.125);
    return o1.add(o2).add(o3);
};

// Heart SDF for craters
const heartSDF = (p: any) => {
    const x = p.x;
    const y = p.y.mul(-1.0).add(0.2); // flip and offset
    const a = x.mul(x).add(y.mul(y)).sub(1.0);
    return a.mul(a).mul(a).sub(x.mul(x).mul(y.mul(y).mul(y)));
};

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
    private sparkleMesh: THREE.InstancedMesh;
    private sparkles: { life: number, maxLife: number, pos: THREE.Vector3, vel: THREE.Vector3, scale: number }[] = [];
    private lastPlayerDist: number = Infinity;

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

        this.sparkleMesh = this.createSparkles();
        this.group.add(this.sparkleMesh);

        this.deactivate();
    }

    private createSparkles(): THREE.InstancedMesh {
        const geo = new THREE.PlaneGeometry(0.5, 0.5);
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        // Add a simple circular mask / glow to sparkles using length(uv - 0.5)
        const vUv = uv();
        const dist = length(vUv.sub(0.5));
        const alpha = smoothstep(0.5, 0.1, dist);
        mat.colorNode = vec4(color(0xffffff), alpha);

        const count = 100;
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        mesh.count = 0; // hide initially

        // Initialize pool
        for(let i=0; i<count; i++) {
            this.sparkles.push({
                life: 0, maxLife: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), scale: 1
            });
        }
        return mesh;
    }

    private spawnSparkles(count: number) {
        let spawned = 0;
        for (let i = 0; i < this.sparkles.length && spawned < count; i++) {
            const p = this.sparkles[i];
            if (p.life <= 0) {
                p.life = 1.0 + Math.random() * 1.5;
                p.maxLife = p.life;

                // Spawn randomly on the surface of the sphere
                const angle1 = Math.random() * Math.PI * 2;
                const angle2 = Math.random() * Math.PI;
                const r = 60; // sphere radius
                p.pos.set(
                    Math.sin(angle2) * Math.cos(angle1) * r,
                    Math.cos(angle2) * r,
                    Math.sin(angle2) * Math.sin(angle1) * r
                );

                p.vel.set(
                    (Math.random() - 0.5) * 2,
                    2 + Math.random() * 3, // drift upwards
                    (Math.random() - 0.5) * 2
                );
                p.scale = 0.5 + Math.random() * 1.5;
                spawned++;
            }
        }
    }

    private createPalace(): THREE.Mesh {
        const geo = new THREE.SphereGeometry(60, 64, 64);

        const mat = new MeshStandardNodeMaterial({
            transparent: true,
            opacity: 0.95,
            roughness: 0.2,
            metalness: 0.9
        });

        const vUv = uv();

        // Crystalline noise facets
        const noiseBase = fbm(vUv.mul(15.0));
        const facets = noiseBase.mul(2.0).fract();
        const crystalDetail = smoothstep(0.4, 0.6, facets);

        // Heart craters
        // Create a grid of repeating hearts
        const gridUv = vUv.mul(vec2(8.0, 4.0)).fract().sub(0.5).mul(4.0); // Scale up to -2..2
        const hDist = heartSDF(gridUv);
        // mask for actual craters vs just pattern everywhere
        const craterMask = smoothstep(0.6, 0.8, fbm(vUv.mul(4.0).add(1.2)));
        const craterDetail = smoothstep(0.1, -0.1, hDist).mul(craterMask);

        const baseColor = color(0xddf8ff);
        const crystalColor = mix(color(0xaaccff), color(0xffffff), crystalDetail);
        const craterColor = color(0xff69b4); // Hot pink craters

        const pulse = sin(time.mul(2.0)).mul(0.1).add(0.9);
        const glow = crystalColor.mul(pulse);

        // Player light interaction
        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const playerLight = smoothstep(150.0, 50.0, distToPlayer);

        const litColor = baseColor.add(glow.mul(0.5)).add(color(0xffffff).mul(playerLight).mul(0.5));
        const finalColor = mix(litColor, craterColor, craterDetail);

        mat.colorNode = vec4(finalColor, 0.95);
        mat.emissiveNode = mix(color(0x88ccff).mul(0.2).add(crystalDetail.mul(0.1)), craterColor.mul(0.8), craterDetail);

        const mesh = new THREE.Mesh(geo, mat);
        return mesh;
    }

    private createLadders(): THREE.InstancedMesh {
        // Flat, elegant slide shape
        const geo = new THREE.BoxGeometry(3, 80, 0.5);
        const mat = new MeshStandardNodeMaterial({
            transparent: true,
            opacity: 0.9,
            roughness: 0.1,
            metalness: 1.0
        });

        const vUv = uv();

        // Energy pulse traveling up the slides
        // We use vUv.y and time to create a scrolling wave
        const slidePulse = sin(vUv.y.mul(20.0).sub(time.mul(5.0))).mul(0.5).add(0.5);
        const shimmer = smoothstep(0.8, 1.0, slidePulse);

        const baseSilver = color(0xddddff);
        const highlightColor = color(0xffffff);

        mat.colorNode = mix(baseSilver, highlightColor, shimmer);
        mat.emissiveNode = highlightColor.mul(shimmer).mul(0.8);

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

        // Approach scaling (parallax) with drama
        let progress = Math.max(0, Math.min(1, cameraX / this.levelDistance));
        // Exponential curve for more dramatic approach at the end
        progress = Math.pow(progress, 2.0);

        // Start far and small, get closer and larger
        const scale = 0.5 + progress * 1.5;
        this.group.scale.setScalar(scale);

        // Move it from deep background to very close
        const startZ = -400;
        const endZ = -80; // Get closer than before
        this.group.position.z = startZ + (endZ - startZ) * progress;

        // Slight rotation to show it's alive
        this.group.rotation.y += 0.05 * delta;
        this.palaceMesh.rotation.x += 0.02 * delta;

        // Handle proximity reaction
        if (playerPos) {
            const worldPos = new THREE.Vector3();
            this.group.getWorldPosition(worldPos);
            const dist = worldPos.distanceTo(playerPos);

            // if we just crossed the threshold, spawn a big burst
            if (dist < 300 && this.lastPlayerDist >= 300) {
                this.spawnSparkles(50);
            } else if (dist < 300) {
                // Continuous small spawn when near
                if (Math.random() < 0.1) this.spawnSparkles(2);
            }
            this.lastPlayerDist = dist;
        }

        // Update particles
        let activeCount = 0;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.sparkles.length; i++) {
            const p = this.sparkles[i];
            if (p.life > 0) {
                p.life -= delta;
                p.pos.addScaledVector(p.vel, delta);

                dummy.position.copy(p.pos);
                // Look at camera
                const worldPos = new THREE.Vector3();
                this.group.getWorldPosition(worldPos);
                dummy.position.add(worldPos); // temp move to world
                dummy.lookAt(this.camera.position);
                dummy.position.copy(p.pos); // back to local

                const shrink = p.life / p.maxLife; // fade out scale
                dummy.scale.setScalar(p.scale * shrink);

                dummy.updateMatrix();
                this.sparkleMesh.setMatrixAt(activeCount, dummy.matrix);
                activeCount++;
            }
        }
        this.sparkleMesh.count = activeCount;
        if (activeCount > 0) {
            this.sparkleMesh.instanceMatrix.needsUpdate = true;
        }
    }

    cleanup() {
        this.scene.remove(this.group);
        this.palaceMesh.geometry.dispose();
        (this.palaceMesh.material as THREE.Material).dispose();

        this.laddersMesh.geometry.dispose();
        (this.laddersMesh.material as THREE.Material).dispose();

        this.windowsMesh.geometry.dispose();
        (this.windowsMesh.material as THREE.Material).dispose();

        this.sparkleMesh.geometry.dispose();
        (this.sparkleMesh.material as THREE.Material).dispose();
    }
}
