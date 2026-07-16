import * as THREE from 'three';
import { FlowerType } from './types';

export class HeartPollenSystem {
    private scene: THREE.Scene;
    private maxHearts: number;
    private hearts: THREE.Mesh[] = [];
    private heartData: Array<{
        velocity: THREE.Vector3;
        life: number;
        maxLife: number;
        scale: number;
        wobble: number;
    }> = [];
    private heartGeometry: THREE.ShapeGeometry;
    private heartMaterial: THREE.MeshBasicMaterial;
    private poolIndex: number = 0;

    constructor(scene: THREE.Scene, maxHearts: number = 100) {
        this.scene = scene;
        this.maxHearts = maxHearts;

        // Create heart shape
        const heartShape = new THREE.Shape();
        const x = 0, y = 0;
        heartShape.moveTo(x + 0.25, y + 0.25);
        heartShape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
        heartShape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
        heartShape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
        heartShape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
        heartShape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
        heartShape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);

        this.heartGeometry = new THREE.ShapeGeometry(heartShape);
        this.heartMaterial = new THREE.MeshBasicMaterial({
            color: 0xff69b4,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });

        // Pre-create heart pool
        for (let i = 0; i < maxHearts; i++) {
            const heart = new THREE.Mesh(this.heartGeometry, this.heartMaterial.clone());
            heart.visible = false;
            heart.scale.setScalar(0.3);
            this.scene.add(heart);
            this.hearts.push(heart);
            this.heartData.push({
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 0,
                scale: 0.3,
                wobble: Math.random() * Math.PI * 2
            });
        }
    }

    emit(position: THREE.Vector3, count: number = 5, color: number = 0xff69b4) {
        for (let i = 0; i < count; i++) {
            const idx = this.poolIndex;
            const heart = this.hearts[idx];
            const data = this.heartData[idx];

            heart.position.copy(position);
            heart.position.x += (Math.random() - 0.5) * 3;
            heart.position.y += (Math.random() - 0.5) * 3;
            heart.position.z += (Math.random() - 0.5) * 2;

            heart.visible = true;
            (heart.material as THREE.MeshBasicMaterial).color.setHex(color);
            (heart.material as THREE.MeshBasicMaterial).opacity = 1;

            // Gentle floating velocity
            data.velocity.set(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.5 + 0.5,
                (Math.random() - 0.5) * 1
            );
            data.life = 2 + Math.random() * 2;
            data.maxLife = data.life;
            data.scale = 0.2 + Math.random() * 0.3;
            data.wobble = Math.random() * Math.PI * 2;

            this.poolIndex = (this.poolIndex + 1) % this.maxHearts;
        }
    }

    update(dt: number) {
        for (let i = 0; i < this.maxHearts; i++) {
            const heart = this.hearts[i];
            const data = this.heartData[i];

            if (!heart.visible || data.life <= 0) continue;

            data.life -= dt;

            if (data.life <= 0) {
                heart.visible = false;
                continue;
            }

            // Update position with gentle floating
            data.wobble += dt * 2;
            heart.position.x += data.velocity.x * dt + Math.sin(data.wobble) * 0.5 * dt;
            heart.position.y += data.velocity.y * dt;
            heart.position.z += data.velocity.z * dt;

            // Gentle rotation
            heart.rotation.y += dt * 0.5;
            heart.rotation.z = Math.sin(data.wobble) * 0.2;

            // Fade and scale
            const lifeRatio = data.life / data.maxLife;
            const scale = data.scale * lifeRatio;
            heart.scale.setScalar(scale);
            (heart.material as THREE.MeshBasicMaterial).opacity = lifeRatio * 0.9;
        }
    }

    cleanup() {
        // Soft reset: deactivate all pooled hearts but keep the reusable pool intact.
        // The pool is created once in the constructor and is never rebuilt, so destroying
        // it here (as a per-level reset) would leave update()/emit() iterating over an
        // empty array up to maxHearts and dereferencing undefined entries.
        for (let i = 0; i < this.hearts.length; i++) {
            this.hearts[i].visible = false;
            this.heartData[i].life = 0;
        }
        this.poolIndex = 0;
    }
}

