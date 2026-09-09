import * as THREE from 'three';
import { time, vec3, vec4, color, uniform, sin, float, mix, length, positionWorld, smoothstep, positionLocal, distance } from 'three/tsl';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';

const RIB_COUNT = 150;
const FOG_PARTICLE_COUNT = 100;
const BARNACLE_COUNT = 60;

function createBoneMaterial(uPlayerPos: any) {
    const mat = new MeshStandardNodeMaterial({
        color: 0xeeddcc,
        roughness: 0.8,
        metalness: 0.1,
    });
    return mat;
}

function createFogMaterial() {
    const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide
    });

    // TSL setup
    const dist = length(positionLocal);
    const alpha = smoothstep(1.0, 0.0, dist).mul(0.15);
    const pulse = sin(time.mul(0.5)).mul(0.5).add(0.5);

    const baseColor = color(0x8844ff);
    const finalColor = mix(baseColor, color(0xff88cc), pulse);

    mat.colorNode = vec4(finalColor, alpha);

    return mat;
}

function createBarnacleMaterial() {
    return new MeshStandardNodeMaterial({
        color: 0x3399aa,
        roughness: 0.4,
        metalness: 0.2
    });
}


export class FossilizedSpaceWhalesSystem {
    scene: THREE.Scene;
    active: boolean = false;

    group: THREE.Group;
    ribMesh: THREE.InstancedMesh;
    fogMesh: THREE.InstancedMesh;
    barnacleMesh: THREE.InstancedMesh;

    dummy: THREE.Object3D;

    uPlayerPos: any;

    barnacles: any[] = [];
    injectObstacleTracking?: (obstacle: any) => void;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.dummy = new THREE.Object3D();
        this.uPlayerPos = uniform(new THREE.Vector3());

        // Ribs
        const ribGeo = new THREE.TorusGeometry(15, 2, 8, 24, Math.PI);
        const ribMat = createBoneMaterial(this.uPlayerPos);
        this.ribMesh = new THREE.InstancedMesh(ribGeo, ribMat, RIB_COUNT);
        this.ribMesh.frustumCulled = false;

        // Fog
        const fogGeo = new THREE.PlaneGeometry(20, 20);
        const fogMat = createFogMaterial();
        this.fogMesh = new THREE.InstancedMesh(fogGeo, fogMat, FOG_PARTICLE_COUNT);
        this.fogMesh.frustumCulled = false;

        // Barnacles
        const barnacleGeo = new THREE.SphereGeometry(1.5, 8, 8);
        const barnacleMat = createBarnacleMaterial();
        this.barnacleMesh = new THREE.InstancedMesh(barnacleGeo, barnacleMat, BARNACLE_COUNT);
        this.barnacleMesh.frustumCulled = false;

        this.group.add(this.ribMesh);
        this.group.add(this.fogMesh);
        this.group.add(this.barnacleMesh);

        this.scene.add(this.group);
        this.deactivate();
    }

    activate(config?: any) {
        if (this.active) return;
        this.active = true;
        this.group.visible = true;
        this.resetLayout(0); // arbitrary initial camera x
    }

    resetLayout(cameraX: number) {
        // Simple initial spread
        for(let i=0; i<RIB_COUNT; i++) {
            this.dummy.position.set(cameraX + i * 20 - 500, 0, -20);
            this.dummy.rotation.set(0, 0, Math.PI / 2);
            this.dummy.scale.set(1, 1, 1);
            this.dummy.updateMatrix();
            this.ribMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.ribMesh.instanceMatrix.needsUpdate = true;

        for(let i=0; i<FOG_PARTICLE_COUNT; i++) {
             this.dummy.position.set(cameraX + Math.random() * 2000 - 500, (Math.random() - 0.5) * 40, -15 - Math.random() * 20);
             this.dummy.scale.setScalar(1 + Math.random() * 2);
             this.dummy.rotation.z = Math.random() * Math.PI;
             this.dummy.updateMatrix();
             this.fogMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.fogMesh.instanceMatrix.needsUpdate = true;

        this.spawnBarnacles(cameraX);
    }

    spawnBarnacles(cameraX: number) {
        this.barnacles = [];
        for (let i = 0; i < BARNACLE_COUNT; i++) {
            const bx = cameraX + Math.random() * 2000 - 500;
            const by = (Math.random() - 0.5) * 30;

            this.dummy.position.set(bx, by, -5);
            this.dummy.updateMatrix();
            this.barnacleMesh.setMatrixAt(i, this.dummy.matrix);

            const obstacle = {
                id: `barnacle_${i}`,
                position: new THREE.Vector3(bx, by, -5),
                radius: 1.5,
                userData: {
                    isBarnacle: true,
                    opened: false,
                    index: i
                }
            };
            this.barnacles.push(obstacle);

            if (this.injectObstacleTracking) {
                this.injectObstacleTracking(obstacle);
            }
        }
        this.barnacleMesh.instanceMatrix.needsUpdate = true;
    }

    setObstacleTracking(fn: (obs: any) => void) {
        this.injectObstacleTracking = fn;
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

        // Wrap logic
        const margin = 500;
        const width = 2000;

        let needRibUpdate = false;
        let needFogUpdate = false;
        let needBarnacleUpdate = false;

        const limitBack = cameraX - margin;
        const limitFront = cameraX + width - margin;

        for (let i = 0; i < RIB_COUNT; i++) {
            this.ribMesh.getMatrixAt(i, this.dummy.matrix);
            this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);
            if (this.dummy.position.x < limitBack) {
                this.dummy.position.x += width;
                this.dummy.updateMatrix();
                this.ribMesh.setMatrixAt(i, this.dummy.matrix);
                needRibUpdate = true;
            }
        }

        for (let i = 0; i < FOG_PARTICLE_COUNT; i++) {
            this.fogMesh.getMatrixAt(i, this.dummy.matrix);
            this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);
            if (this.dummy.position.x < limitBack) {
                this.dummy.position.x += width;
                this.dummy.position.y = (Math.random() - 0.5) * 40;
                this.dummy.updateMatrix();
                this.fogMesh.setMatrixAt(i, this.dummy.matrix);
                needFogUpdate = true;
            }
        }

        for (let i = 0; i < BARNACLE_COUNT; i++) {
            this.barnacleMesh.getMatrixAt(i, this.dummy.matrix);
            this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);
            if (this.dummy.position.x < limitBack) {
                this.dummy.position.x += width;
                this.dummy.position.y = (Math.random() - 0.5) * 30;
                this.dummy.updateMatrix();
                this.barnacleMesh.setMatrixAt(i, this.dummy.matrix);

                // Update logical position
                if (this.barnacles[i]) {
                    this.barnacles[i].position.copy(this.dummy.position);
                    this.barnacles[i].userData.opened = false;
                }

                needBarnacleUpdate = true;
            }
        }

        if (needRibUpdate) this.ribMesh.instanceMatrix.needsUpdate = true;
        if (needFogUpdate) this.fogMesh.instanceMatrix.needsUpdate = true;
        if (needBarnacleUpdate) this.barnacleMesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.scene.remove(this.group);
        this.ribMesh.geometry.dispose();
        (this.ribMesh.material as any).dispose?.();
        this.fogMesh.geometry.dispose();
        (this.fogMesh.material as any).dispose?.();
        this.barnacleMesh.geometry.dispose();
        (this.barnacleMesh.material as any).dispose?.();
    }
}
