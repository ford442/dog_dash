import * as THREE from 'three';
import { time, color, positionWorld, mix, smoothstep, uniform } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import type { TSLNode, TSLUniform } from './tsl_types';
import { comboCorridorRandom } from './combo_corridor_rng';

export interface ComboCorridorEnvironmentConfig {
    density?: number;
    speed?: number;
}

export class ComboCorridorSystem {
    scene: THREE.Scene;
    active: boolean = false;
    mesh!: THREE.InstancedMesh;
    ringCount: number = 40;

    private uPlayerPos: TSLUniform<THREE.Vector3>;
    private _dummy = new THREE.Object3D();
    private _position = new THREE.Vector3();
    private _quaternion = new THREE.Quaternion();
    private _scale = new THREE.Vector3();
    private _speed: number = 1.0;
    private readonly corridorWidth = 800;
    private readonly wrapMargin = 100;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.uPlayerPos = uniform(new THREE.Vector3(0, 0, 0)) as TSLUniform<THREE.Vector3>;
        this.initRings();
        this.deactivate();
    }

    private initRings() {
        const geo = new THREE.TorusGeometry(12, 0.4, 8, 32);
        geo.rotateY(Math.PI / 2);

        const mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        // World-space proximity (correct for InstancedMesh; positionLocal is instance-local)
        const dist: TSLNode = positionWorld.sub(this.uPlayerPos).length();
        const glowIntensity: TSLNode = smoothstep(50.0, 5.0, dist);
        const pulse: TSLNode = time.mul(4.0).add(positionWorld.x.mul(0.05)).sin().mul(0.5).add(0.5);
        const combined: TSLNode = pulse.add(glowIntensity.mul(0.5)).clamp(0, 1);
        mat.colorNode = color(0xff00ff).mul(combined).add(color(0x00ffff).mul(combined.oneMinus()));

        const spacing = this.corridorWidth / this.ringCount;
        this.mesh = new THREE.InstancedMesh(geo, mat, this.ringCount);
        this.mesh.frustumCulled = false;

        for (let i = 0; i < this.ringCount; i++) {
            this._dummy.position.set(
                i * spacing,
                (comboCorridorRandom() - 0.5) * 20,
                (comboCorridorRandom() - 0.5) * 20
            );
            this._dummy.scale.setScalar(0.5 + comboCorridorRandom() * 1.5);
            this._dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this._dummy.matrix);
        }

        this.scene.add(this.mesh);
    }

    activate(config?: ComboCorridorEnvironmentConfig) {
        if (this.active) return;
        this.active = true;
        this._speed = config?.speed ?? 1.0;
        this.mesh.visible = true;
        if (config?.density !== undefined) {
            this.mesh.scale.setScalar(config.density);
        }
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.mesh.visible = false;
    }

    update(_delta: number, cameraX: number, playerPos?: THREE.Vector3) {
        if (!this.active) return;

        if (playerPos) {
            this.uPlayerPos.value.copy(playerPos);
        }

        const limitBack = cameraX - this.corridorWidth * 0.5 - this.wrapMargin;
        const limitFront = cameraX + this.corridorWidth * 0.5 + this.wrapMargin;
        const wrapRange = this.corridorWidth + this.wrapMargin * 2;

        let dirty = false;
        for (let i = 0; i < this.ringCount; i++) {
            this.mesh.getMatrixAt(i, this._dummy.matrix);
            this._dummy.matrix.decompose(this._position, this._quaternion, this._scale);

            if (this._position.x < limitBack) {
                this._position.x += wrapRange + this._speed * 50;
                this._position.y = (comboCorridorRandom() - 0.5) * 20;
                this._position.z = (comboCorridorRandom() - 0.5) * 20;
            } else if (this._position.x > limitFront) {
                this._position.x -= wrapRange;
            } else {
                continue;
            }

            this._dummy.position.copy(this._position);
            this._dummy.quaternion.copy(this._quaternion);
            this._dummy.scale.copy(this._scale);
            this._dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this._dummy.matrix);
            dirty = true;
        }

        if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        if (!this.mesh) return;
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose?.();
    }
}