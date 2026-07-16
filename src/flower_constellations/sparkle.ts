import * as THREE from 'three';

export class GoldenSparkleSystem {
    private scene: THREE.Scene;
    private maxSparkles: number;
    private sparkles: THREE.Mesh[] = [];
    private sparkleData: Array<{
        velocity: THREE.Vector3;
        life: number;
        maxLife: number;
        baseScale: number;
    }> = [];
    private poolIndex: number = 0;

    constructor(scene: THREE.Scene, maxSparkles: number = 50) {
        this.scene = scene;
        this.maxSparkles = maxSparkles;

        // Star shape geometry
        const geometry = new THREE.OctahedronGeometry(0.1, 0);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            transparent: true,
            opacity: 1
        });

        for (let i = 0; i < maxSparkles; i++) {
            const sparkle = new THREE.Mesh(geometry, material.clone());
            sparkle.visible = false;
            this.scene.add(sparkle);
            this.sparkles.push(sparkle);
            this.sparkleData.push({
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 0,
                baseScale: 0.1
            });
        }
    }

    emit(position: THREE.Vector3, count: number = 3) {
        for (let i = 0; i < count; i++) {
            const idx = this.poolIndex;
            const sparkle = this.sparkles[idx];
            const data = this.sparkleData[idx];

            sparkle.position.copy(position);
            sparkle.position.x += (Math.random() - 0.5) * 2;
            sparkle.position.y += (Math.random() - 0.5) * 2;
            sparkle.position.z += Math.random() * 1;

            sparkle.visible = true;
            sparkle.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            // Drift downward slowly
            data.velocity.set(
                (Math.random() - 0.5) * 1,
                -Math.random() * 1 - 0.5,
                (Math.random() - 0.5) * 0.5
            );
            data.life = 1.5 + Math.random();
            data.maxLife = data.life;
            data.baseScale = 0.05 + Math.random() * 0.1;

            this.poolIndex = (this.poolIndex + 1) % this.maxSparkles;
        }
    }

    update(dt: number) {
        for (let i = 0; i < this.maxSparkles; i++) {
            const sparkle = this.sparkles[i];
            const data = this.sparkleData[i];

            if (!sparkle.visible || data.life <= 0) continue;

            data.life -= dt;

            if (data.life <= 0) {
                sparkle.visible = false;
                continue;
            }

            sparkle.position.addScaledVector(data.velocity, dt);
            sparkle.rotation.x += dt * 2;
            sparkle.rotation.y += dt * 3;

            // Twinkle effect
            const lifeRatio = data.life / data.maxLife;
            const twinkle = 0.5 + Math.sin(data.life * 10) * 0.5;
            const scale = data.baseScale * lifeRatio * (0.5 + twinkle * 0.5);
            sparkle.scale.setScalar(scale);
            (sparkle.material as THREE.MeshBasicMaterial).opacity = lifeRatio * twinkle;
        }
    }

    cleanup() {
        // Soft reset: deactivate all pooled sparkles but keep the reusable pool intact.
        // (See HeartPollenSystem.cleanup — the pool is only built once in the constructor.)
        for (let i = 0; i < this.sparkles.length; i++) {
            this.sparkles[i].visible = false;
            this.sparkleData[i].life = 0;
        }
        this.poolIndex = 0;
    }
}

