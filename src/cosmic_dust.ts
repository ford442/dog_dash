import * as THREE from 'three';
import { time, vec3, color, uniform, sin, mix, positionLocal, positionWorld, float, uv, length, smoothstep, Loop } from 'three/tsl';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';


export class CosmicDustSystem {
    weaponLightManager?: any;
    uPlayerPos: any = uniform(new THREE.Vector3(0,0,0));

    scene: THREE.Scene;
    active: boolean = false;
    mesh: THREE.InstancedMesh;
    count: number = 2000;
    width: number = 800;
    height: number = 400;
    depth: number = 400;
    dummy: THREE.Object3D;
    baseYs: Float32Array;
    baseRotations: Float32Array;

    constructor(scene: THREE.Scene, weaponLightManager?: any) {
        this.weaponLightManager = weaponLightManager;
        this.scene = scene;
        this.dummy = new THREE.Object3D();

        // 1. Create geometry (small quad)
        const geo = new THREE.PlaneGeometry(0.5, 0.5);

        // 2. Create TSL material
        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending
        });

        // Base color and glow
        const baseColor = color(0xaaccff);
        const pulse = sin(time.mul(2.0).add(positionWorld.x.mul(0.1))).mul(0.5).add(0.5);

        // Circular soft alpha

        const distFromCenter = uv().sub(0.5).length();

        const distToPlayer = length(positionWorld.sub(this.uPlayerPos));
        const playerGlow = smoothstep(30.0, 0.0, distToPlayer).mul(0.8);
        const engineColor = color(0xffaa00);
        let finalColor = vec3(baseColor.mul(pulse)).add(vec3(engineColor).mul(playerGlow));

        // Weapon lights glow
        if (this.weaponLightManager && this.weaponLightManager.storageNode) {
            const lights = this.weaponLightManager.storageNode;
            const maxLights = this.weaponLightManager.maxLights;

            const weaponGlow = float(0.0).toVar();
            Loop(maxLights, ({ i }) => {
                const lightActive = lights.element(i).x;
                const lightPos = vec3(lights.element(i).y, lights.element(i).z, lights.element(i).w);
                const lightDist = length(positionWorld.sub(lightPos));
                const glow = smoothstep(20.0, 0.0, lightDist).mul(lightActive);
                weaponGlow.addAssign(glow);
            });
            finalColor = finalColor.add(vec3(0.0, 1.0, 1.0).mul(weaponGlow).mul(0.6));
        }

        const alpha = float(1.0).sub(distFromCenter.mul(2.0)).max(0.0).pow(2.0);

        mat.colorNode = finalColor;
        mat.opacityNode = alpha.mul(0.6); // Base opacity

        // 3. Create InstancedMesh
        this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 1; // Render after opaque objects

        // Store base Y positions for framerate-independent bobbing
        this.baseYs = new Float32Array(this.count);
        this.baseRotations = new Float32Array(this.count);

        // 4. Initialize positions
        for (let i = 0; i < this.count; i++) {
            const baseY = (Math.random() - 0.5) * this.height;
            this.baseYs[i] = baseY;
            this.baseRotations[i] = Math.random() * Math.PI * 2;

            this.dummy.position.set(
                (Math.random() - 0.5) * this.width,
                baseY,
                (Math.random() - 0.5) * this.depth - 50 // Mostly background
            );

            // Randomize size
            const scale = Math.random() * 0.8 + 0.2;
            this.dummy.scale.set(scale, scale, scale);

            // Random rotation
            this.dummy.rotation.z = this.baseRotations[i];

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;

        this.scene.add(this.mesh);
        this.deactivate();
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this.mesh.visible = true;
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    update(delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (playerPos) this.uPlayerPos.value.copy(playerPos);
        if (!this.active) return;

        // Wrapping logic
        const margin = this.width / 2;
        const limitBack = cameraX - margin;
        const limitFront = cameraX + margin;

        let needsUpdate = false;

        for (let i = 0; i < this.count; i++) {
            this.mesh.getMatrixAt(i, this.dummy.matrix);
            this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);

            // Drift slowly leftwards
            this.dummy.position.x -= delta * 5.0 * (1.0 - (this.dummy.position.z / -200));

            // Wrap around
            if (this.dummy.position.x < limitBack) {
                this.dummy.position.x += this.width;
                this.baseYs[i] = (Math.random() - 0.5) * this.height;
                needsUpdate = true;
            } else if (this.dummy.position.x > limitFront) {
                 this.dummy.position.x -= this.width;
                 this.baseYs[i] = (Math.random() - 0.5) * this.height;
                 needsUpdate = true;
            }

            // Framerate-independent bobbing based on Date.now() and instance ID
            this.dummy.position.y = this.baseYs[i] + Math.sin(Date.now() * 0.001 + i) * 2.0;

            // Update continuous rotation tracking array to prevent quaternion decomposition issues
            this.baseRotations[i] += delta * 0.2;
            this.dummy.rotation.set(0, 0, this.baseRotations[i]);

            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        // Material dispose logic if needed
    }
}
